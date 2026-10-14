import Link from "next/link";
import { ArrowUpRight, Pencil, Archive, ArchiveRestore } from "lucide-react";
import type { ProjectSummary } from "@/lib/types";
import { avatarClasses } from "@/lib/colors";
import { useProjectList } from "@/lib/api/use-project-list";
export function ProjectCard({
  project,
  onEdit,
}: {
  project: ProjectSummary;
  onEdit: () => void;
}) {
  const { save, busy } = useProjectList(),
    progress = project.taskCount
      ? Math.round((project.completedCount / project.taskCount) * 100)
      : 0;
  return (
    <article className="flex flex-col rounded-xl border border-brand-line bg-white p-6 transition-shadow hover:shadow-sm">
      <div className="mb-8 flex justify-between">
        <span
          className={`h-2 w-12 rounded-full ${avatarClasses[project.color]}`}
        />
        <div className="flex gap-3 text-brand-muted">
          <button aria-label={`Edit ${project.name}`} onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <button
            disabled={busy}
            aria-label={`${project.archived ? "Restore" : "Archive"} ${project.name}`}
            onClick={() =>
              void save({
                type: "update",
                id: project.id,
                archived: !project.archived,
              })
            }
          >
            {project.archived ? (
              <ArchiveRestore size={16} />
            ) : (
              <Archive size={16} />
            )}
          </button>
        </div>
      </div>
      <Link
        className="group flex items-center justify-between gap-4"
        href={`/projects/${project.id}`}
      >
        <h2 className="text-xl font-medium tracking-tight">{project.name}</h2>
        <ArrowUpRight
          size={20}
          className="shrink-0 text-brand-muted group-hover:text-brand-ink"
        />
      </Link>
      <p className="mt-2 text-xs text-brand-muted">
        {project.taskCount} tasks · {project.completedCount} complete
      </p>
      <div className="mb-2 mt-8 flex justify-between text-[11px] text-brand-muted">
        <span>Tasks completed</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-stone">
        <div
          className="h-full rounded-full bg-brand-gold"
          style={{ width: progress + "%" }}
        />
      </div>
    </article>
  );
}
