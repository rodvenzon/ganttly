"use client";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Command } from "./commands";
import { commandSchema } from "./commands";
import { applyCommand } from "./apply-command";
import { request, RequestError, type ProjectEnvelope } from "./client";
import { useUI } from "@/store/ui";
import { useMe } from "./use-me";
type Actions = {
  commit: (command: Command) => Promise<boolean>;
  busy: boolean;
};
const Context = createContext<Actions | null>(null);
export function ProjectActions({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const cache = useQueryClient(),
    lock = useRef(false),
    authorName = useMe().data?.name ?? "You";
  const notify = useUI((s) => s.notify),
    setPreview = useUI((s) => s.setPreview);
  const key = ["project", id];
  const mutation = useMutation({
    mutationKey: ["edit", id],
    mutationFn: (input: { command: Command; baseVersion: string }) =>
      request<ProjectEnvelope>(
        `/api/projects/${encodeURIComponent(id)}/commands`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onMutate: async ({ command }) => {
      await cache.cancelQueries({ queryKey: key });
      const snapshot = cache.getQueryData<ProjectEnvelope>(key);
      if (!snapshot) throw Error("Project has not loaded");
      const project = applyCommand(snapshot.project, command, {
        authorName,
        now: new Date().toISOString(),
      });
      cache.setQueryData(key, { ...snapshot, project });
      setPreview(null);
      return { snapshot };
    },
    onSuccess: (data) => {
      cache.setQueryData(key, data);
      void cache.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error, _input, context) => {
      if (context) cache.setQueryData(key, context.snapshot);
      setPreview(null);
      notify(error.message);
      if (error instanceof RequestError && error.status === 409)
        void cache.invalidateQueries({ queryKey: key });
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  async function commit(input: Command) {
    if (lock.current) {
      notify("Saving your previous edit. Try again in a moment.");
      setPreview(null);
      return false;
    }
    const current = cache.getQueryData<ProjectEnvelope>(key);
    if (!current) return false;
    try {
      const command = commandSchema.parse(input);
      applyCommand(current.project, command, {
        authorName,
        now: new Date().toISOString(),
      });
      lock.current = true;
      await mutation.mutateAsync({ command, baseVersion: current.version });
      return true;
    } catch (error) {
      lock.current = false;
      setPreview(null);
      notify(
        error instanceof Error ? error.message : "Unable to save this edit",
      );
      return false;
    }
  }
  return (
    <Context.Provider value={{ commit, busy: mutation.isPending }}>
      {children}
    </Context.Provider>
  );
}
export function useProjectActions() {
  const value = useContext(Context);
  if (!value) throw Error("ProjectActions provider missing");
  return value;
}
