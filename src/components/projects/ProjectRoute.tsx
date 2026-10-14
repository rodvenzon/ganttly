"use client";
import { useSyncExternalStore } from "react";
import { ProjectWorkspace } from "./ProjectWorkspace";
const subscribe = (notify: () => void) => {
  addEventListener("popstate", notify);
  return () => removeEventListener("popstate", notify);
};
const fromAddress = () =>
  decodeURIComponent(location.pathname.split("/")[2] ?? "");
export function ProjectRoute({ id }: { id: string }) {
  const address = useSyncExternalStore(subscribe, fromAddress, () => null);
  const resolved = id === "_" ? address : id;
  if (!resolved || resolved === "_") return null;
  return <ProjectWorkspace key={resolved} id={resolved} />;
}
