import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import type { Task, ProjectDetail } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { useProjectActions } from "@/lib/api/use-project-actions";
export function TaskDependencies({
  task,
  project,
}: {
  task: Task;
  project: ProjectDetail;
}) {
  const { commit, busy } = useProjectActions(),
    [parent, setParent] = useState("");
  const incoming = project.dependencies.filter(
      (d) => d.successorTaskId === task.id,
    ),
    outgoing = project.dependencies.filter(
      (d) => d.predecessorTaskId === task.id,
    );
  async function add() {
    if (
      parent &&
      (await commit({
        type: "dependency.add",
        id: crypto.randomUUID(),
        predecessorTaskId: parent,
        successorTaskId: task.id,
      }))
    )
      setParent("");
  }
  return (
    <section className="mt-7 border-t border-brand-line pt-6">
      <h3 className="text-sm font-semibold">Dependencies</h3>
      <p className="mt-1 text-xs text-brand-muted">
        Finish to start · Successors begin at least one day later.
      </p>
      <div className="my-3 space-y-2">
        {[...incoming, ...outgoing].map((d) => {
          const before = d.successorTaskId === task.id,
            other = project.tasks.find(
              (t) =>
                t.id === (before ? d.predecessorTaskId : d.successorTaskId),
            );
          return (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded border border-brand-line bg-white p-3 text-xs"
            >
              <ArrowRight size={14} />
              <span className="min-w-0 flex-1">
                <span className="text-brand-muted">
                  {before ? "After: " : "Before: "}
                </span>
                {other?.name}
              </span>
              <button
                disabled={busy || project.archived}
                onClick={() =>
                  void commit({ type: "dependency.remove", id: d.id })
                }
                aria-label={`Remove dependency with ${other?.name}`}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
        {!incoming.length && !outgoing.length && (
          <p className="text-xs text-brand-muted">No linked tasks yet.</p>
        )}
      </div>
      <div className="flex gap-2">
        <select
          aria-label="Predecessor task"
          className={inputClass}
          value={parent}
          onChange={(e) => setParent(e.target.value)}
        >
          <option value="">Add a predecessor…</option>
          {project.tasks
            .filter(
              (t) =>
                t.id !== task.id &&
                !incoming.some((d) => d.predecessorTaskId === t.id),
            )
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <Button
          disabled={!parent || busy || project.archived}
          onClick={() => void add()}
        >
          Link
        </Button>
      </div>
    </section>
  );
}
