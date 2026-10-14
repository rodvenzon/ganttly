import {
  useMutation,
  useQueryClient,
  useIsMutating,
} from "@tanstack/react-query";
import { request, fetchProject, type ProjectEnvelope } from "./client";
import type { ProjectSummary, ColorKey } from "@/lib/types";
import { useUI } from "@/store/ui";
type Input =
  | {
      type: "create";
      id: string;
      name: string;
      color: ColorKey;
      skipWeekends: boolean;
    }
  | {
      type: "update";
      id: string;
      name?: string;
      color?: ColorKey;
      archived?: boolean;
      skipWeekends?: boolean;
    };
export function useProjectList() {
  const cache = useQueryClient(),
    notify = useUI((s) => s.notify);
  const pending = useIsMutating({ mutationKey: ["project-list-edit"] });
  const mutation = useMutation({
    mutationKey: ["project-list-edit"],
    mutationFn: async (input: Input) => {
      if (input.type === "create")
        return request<ProjectEnvelope>("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            id: input.id,
            name: input.name,
            color: input.color,
            skipWeekends: input.skipWeekends,
          }),
        });
      const current = await fetchProject(input.id);
      const patch = {
        name: input.name,
        color: input.color,
        archived: input.archived,
        skipWeekends: input.skipWeekends,
      };
      return request<ProjectEnvelope>(
        `/api/projects/${encodeURIComponent(input.id)}/commands`,
        {
          method: "POST",
          body: JSON.stringify({
            baseVersion: current.version,
            command: { type: "project.update", ...patch },
          }),
        },
      );
    },
    onMutate: async (input) => {
      await cache.cancelQueries({ queryKey: ["projects"] });
      const snapshot = cache.getQueryData<ProjectSummary[]>(["projects"]);
      cache.setQueryData<ProjectSummary[]>(["projects"], (list) =>
        input.type === "create"
          ? [
              {
                id: input.id,
                name: input.name,
                color: input.color,
                archived: false,
                skipWeekends: input.skipWeekends,
                createdAt: new Date().toISOString(),
                taskCount: 0,
                completedCount: 0,
              },
              ...(list ?? []),
            ]
          : list?.map((p) => (p.id === input.id ? { ...p, ...input } : p)),
      );
      return { snapshot };
    },
    onError: (error, _input, context) => {
      if (context?.snapshot) cache.setQueryData(["projects"], context.snapshot);
      notify(error.message);
    },
    onSuccess: (data) => cache.setQueryData(["project", data.project.id], data),
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  return {
    busy: pending > 0,
    save: async (input: Input) => {
      if (cache.isMutating({ mutationKey: ["project-list-edit"] })) {
        notify("Please wait for the current project edit to save.");
        return false;
      }
      try {
        await mutation.mutateAsync(input);
        return true;
      } catch {
        return false;
      }
    },
  };
}
