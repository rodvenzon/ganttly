import type { Person, ProjectDetail, ProjectSummary } from "@/lib/types";
export interface ProjectEnvelope {
  project: ProjectDetail;
  version: string;
}
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "Request failed";
    const code =
      data && typeof data === "object" && "code" in data
        ? String(data.code)
        : undefined;
    throw new RequestError(message, response.status, code);
  }
  return data as T;
}
export const fetchProjects = () => request<ProjectSummary[]>("/api/projects");
export const fetchProject = (id: string) =>
  request<ProjectEnvelope>(`/api/projects/${encodeURIComponent(id)}`);
export interface MeEnvelope {
  user: Person;
  /** Present when the server runs as the public demo. */
  demo?: { ttlDays: number };
}
export const fetchMe = () => request<MeEnvelope>("/api/me");
export const resetDemo = () =>
  request<{ ok: true }>("/api/demo/reset", { method: "POST", body: "{}" });
export const fetchPeople = () => request<Person[]>("/api/people");
export type EnrollInput = { name: string; title: string; email: string };
export type PersonPatch = Partial<
  Pick<Person, "name" | "title" | "email" | "active">
>;
export const enrollPerson = (input: EnrollInput) =>
  request<Person>("/api/people", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updatePerson = (id: string, patch: PersonPatch) =>
  request<Person>(`/api/people/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
