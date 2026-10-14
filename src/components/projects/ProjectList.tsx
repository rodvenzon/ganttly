"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FolderOpen } from "lucide-react";
import { fetchProjects } from "@/lib/api/client";
import type { ProjectSummary } from "@/lib/types";
import { Shell } from "@/components/ui/Shell";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ProjectCard } from "./ProjectCard";
import { ProjectForm } from "./ProjectForm";
import { ExportReport } from "@/components/report/ExportReport";
export function ProjectList() {
  const query = useQuery({ queryKey: ["projects"], queryFn: fetchProjects }),
    [archived, setArchived] = useState(false),
    [form, setForm] = useState<{ project: ProjectSummary | null } | null>(null);
  const shown = query.data?.filter((p) => p.archived === archived) ?? [];
  return (
    <Shell>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-3 text-xs tracking-[.22em] text-brand-muted">
                VISUAL PROJECT PLANNING
              </p>
              <h1 className="text-4xl font-medium tracking-tight">
                Every project on one timeline.
              </h1>
              <p className="mt-3 text-sm text-brand-muted">
                Drag to schedule, link dependencies, and watch the plan adjust
                itself.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ExportReport />
              <Button
                variant="primary"
                onClick={() => setForm({ project: null })}
              >
                <Plus size={16} />
                New project
              </Button>
            </div>
          </div>
          <div className="mb-6 mt-10 flex gap-6 border-b border-brand-line">
            <button
              onClick={() => setArchived(false)}
              className={`border-b-2 pb-3 text-sm ${!archived ? "border-brand-accent font-semibold" : "border-transparent text-brand-muted"}`}
            >
              Active projects
            </button>
            <button
              onClick={() => setArchived(true)}
              className={`border-b-2 pb-3 text-sm ${archived ? "border-brand-accent font-semibold" : "border-transparent text-brand-muted"}`}
            >
              Archived
            </button>
          </div>
          {query.isPending ? (
            <p className="py-10 text-brand-muted">Loading your projects…</p>
          ) : query.isError ? (
            <div className="py-10">
              <p className="mb-3">{query.error.message}</p>
              <Button onClick={() => query.refetch()}>Retry</Button>
            </div>
          ) : shown.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onEdit={() => setForm({ project: p })}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-brand-line py-16 text-center">
              <FolderOpen size={32} className="mx-auto mb-4 text-brand-muted" />
              <p className="text-lg">
                {archived
                  ? "No archived projects"
                  : "Your next project starts here"}
              </p>
              <p className="mt-2 text-sm text-brand-muted">
                {archived
                  ? "Archived projects will appear here."
                  : "Create a project, then add tasks and phases to build your timeline."}
              </p>
            </div>
          )}
        </div>
      </main>
      {form && (
        <ProjectForm
          key={form.project?.id ?? "new"}
          project={form.project}
          onClose={() => setForm(null)}
        />
      )}
      <Toast />
    </Shell>
  );
}
