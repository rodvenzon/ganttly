export const COLOR_KEYS = [
  "gold",
  "stone",
  "graphite",
  "sand",
  "champagne",
  "dune",
  "mist",
  "pearl",
  "coral",
  "lagoon",
  "harbour",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type DateOnly = string;
export interface Project {
  id: string;
  name: string;
  color: ColorKey;
  createdAt: string;
  archived: boolean;
  /** Count working days only (Saturdays and Sundays are skipped). */
  skipWeekends: boolean;
}
export interface TaskGroup {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
}
export interface Task {
  id: string;
  projectId: string;
  groupId: string | null;
  name: string;
  startDate: DateOnly | null;
  endDate: DateOnly | null;
  percentComplete: number;
  color: ColorKey | null;
  sortOrder: number;
  isMilestone: boolean;
  assigneeIds: string[];
}
export interface Dependency {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  type: "finish_to_start";
}
/** Someone tasks can be assigned to: every enrolled person. */
export interface Assignee {
  id: string;
  name: string;
  avatarColor: ColorKey;
  /** Job title, e.g. "Creative Manager". */
  title: string;
  /** False once the super admin removes their access; kept for old tasks. */
  active: boolean;
}
export const ROLES = ["super_admin", "member"] as const;
export type Role = (typeof ROLES)[number];
/** The full directory entry, visible to the super admin. */
export interface Person extends Assignee {
  /** Their Cloudflare Access sign-in email; null until set. */
  email: string | null;
  role: Role;
}
/**
 * Signed-in edition only: restrict enrollment to one email domain (e.g.
 * "company.com"), or null to allow any address.
 */
export const ALLOWED_EMAIL_DOMAIN: string | null = null;
export interface Comment {
  id: string;
  taskId: string;
  authorName: string;
  body: string;
  createdAt: string;
}
export interface ProjectDetail extends Project {
  groups: TaskGroup[];
  tasks: Task[];
  dependencies: Dependency[];
  assignees: Assignee[];
  comments: Comment[];
}
export interface ProjectSummary extends Project {
  taskCount: number;
  completedCount: number;
}
