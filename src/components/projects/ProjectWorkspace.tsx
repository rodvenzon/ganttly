"use client";
import { ProjectStatus } from "./ProjectStatus";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { AddWork } from "./AddWork";
import { ExportReport } from "@/components/report/ExportReport";
import { ProjectActions } from "@/lib/api/use-project-actions";
import { Toast } from "@/components/ui/Toast";
import { useQuery } from "@tanstack/react-query";
import { fetchProject } from "@/lib/api/client";
import { Shell } from "@/components/ui/Shell";
import { GanttChart } from "@/components/gantt/GanttChart";
import { Button } from "@/components/ui/Button";
import { useUI } from "@/store/ui";
import { ZOOMS, type Zoom } from "@/lib/scheduling/constants";
export function ProjectWorkspace({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
  });
  const { zoom, setZoom } = useUI();
  return (
    <ProjectActions id={id}>
      <Shell>
        {query.isPending ? (
          <p className="p-8 text-brand-muted">Loading project…</p>
        ) : query.isError ? (
          <div className="p-8">
            <p>{query.error.message}</p>
            <Button onClick={() => query.refetch()}>Retry</Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-7">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs tracking-[.2em] text-brand-muted">
                  PROJECT TIMELINE
                </p>
                <h1 className="text-3xl font-medium tracking-tight">
                  {query.data.project.name}
                </h1>
                <p className="mt-2 text-sm text-brand-muted">
                  {query.data.project.tasks.length} tasks ·{" "}
                  {query.data.project.groups.length} phases
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ExportReport projectId={id} />
                <AddWork project={query.data.project} />
                <div className="flex gap-1 rounded-lg border border-brand-line bg-white p-1">
                  {(Object.keys(ZOOMS) as Zoom[]).map((z) => (
                    <Button
                      key={z}
                      variant={z === zoom ? "primary" : "ghost"}
                      onClick={() => setZoom(z)}
                      className="capitalize"
                    >
                      {z}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <ProjectStatus archived={query.data.project.archived} />
            <GanttChart project={query.data.project} />
            <TaskDrawer project={query.data.project} />
            <p className="py-3 text-xs text-brand-muted">
              Calendar days · Weekends shaded · Dates snap to whole days
            </p>
          </div>
        )}
        <Toast />
      </Shell>
    </ProjectActions>
  );
}
