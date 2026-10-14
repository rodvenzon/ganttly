import { cascade } from "@/lib/scheduling/cascade";
import { addDays, format, startOfWeek } from "date-fns";
import { type ProjectDetail, type Role, COLOR_KEYS } from "@/lib/types";
/**
 * The sample team (fictional). person-1 is the super admin in the signed-in
 * edition; the public demo has no admin and treats every visitor as a guest.
 */
export const DEFAULT_PEOPLE: {
  id: string;
  name: string;
  title: string;
  role: Role;
  avatarColor: (typeof COLOR_KEYS)[number];
}[] = [
  ["Maya Torres", "Head of Marketing"],
  ["Alex Morgan", "Project Lead"],
  ["Jamie Chen", "Designer"],
  ["Sam Rivera", "Developer"],
  ["Priya Nair", "Content Lead"],
].map(([name, title], i) => ({
  id: `person-${i}`,
  name,
  title,
  role: i === 1 ? "super_admin" : "member",
  avatarColor: COLOR_KEYS[i],
}));
const names = [
  [
    "Project kickoff",
    "Stakeholder interviews",
    "Audience research",
    "Content audit",
    "Competitor review",
    "Brand workshop",
    "Requirements document",
    "Strategy sign-off",
    "Success metrics",
    "Discovery review",
  ],
  [
    "Sitemap",
    "User flows",
    "Wireframe exploration",
    "Homepage concept",
    "Design system",
    "Content templates",
    "Responsive layouts",
    "Prototype testing",
    "Design refinement",
    "Design handoff",
  ],
  [
    "Application foundation",
    "Navigation & shell",
    "Core screens",
    "Content integration",
    "API integration",
    "Accessibility pass",
    "Responsive build",
    "Integration tests",
    "Bug fixes",
    "Build handoff",
  ],
  [
    "Quality assurance",
    "Content review",
    "Performance review",
    "Browser testing",
    "Stakeholder walkthrough",
    "Final approvals",
    "Launch checklist",
    "Go live",
    "Post-launch review",
    "Future improvements",
  ],
];
export function demoProject(count = 40): ProjectDetail {
  const start = startOfWeek(addDays(new Date(), -7), { weekStartsOn: 1 });
  const assignees = DEFAULT_PEOPLE.map(({ id, name, avatarColor, title }) => ({
    id,
    name,
    avatarColor,
    title,
    active: true,
  }));
  const groups = [
    "Discovery & strategy",
    "Design & experience",
    "Development",
    "Launch & handover",
  ].map((name, i) => ({
    id: `group-${i}`,
    projectId: "demo-project",
    name,
    sortOrder: i,
  }));
  const tasks = Array.from({ length: count }, (_, i) => {
    const group = Math.min(3, Math.floor(i / (count / 4))),
      offset = group * 12 + (i % 10) * 2;
    const date = format(addDays(start, offset), "yyyy-MM-dd"),
      unscheduled = i === 8 || i === 18,
      isMilestone = i % 10 === 9;
    return {
      id: `task-${i}`,
      projectId: "demo-project",
      groupId: groups[group].id,
      name:
        names[group][i % 10] + (count > 40 ? ` ${Math.floor(i / 40) + 1}` : ""),
      startDate: unscheduled ? null : date,
      endDate: unscheduled
        ? null
        : format(addDays(start, offset + (isMilestone ? 0 : 3)), "yyyy-MM-dd"),
      percentComplete:
        i < 6 ? 100 : i < 14 ? Math.min(90, ((i % 5) + 1) * 15) : 0,
      color: null,
      sortOrder: i,
      isMilestone,
      assigneeIds: [assignees[i % 5].id],
    };
  });
  const dependencies = Array.from({ length: 10 }, (_, i) => ({
    id: `dependency-${i}`,
    predecessorTaskId: `task-${i * 3}`,
    successorTaskId: `task-${i * 3 + 2}`,
    type: "finish_to_start" as const,
  }));
  return {
    id: "demo-project",
    name: "Website relaunch",
    color: "lagoon",
    createdAt: new Date().toISOString(),
    archived: false,
    groups,
    tasks: cascade(tasks, dependencies),
    dependencies,
    assignees,
    comments: [
      {
        id: "comment-0",
        taskId: "task-0",
        authorName: "Alex Morgan",
        body: "Align on the scope, owners, and first delivery milestone.",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
