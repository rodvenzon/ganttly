import { useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import type { ProjectDetail, Task } from "@/lib/types";
import { useProjectActions } from "@/lib/api/use-project-actions";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
export function TaskComments({
  task,
  project,
}: {
  task: Task;
  project: ProjectDetail;
}) {
  const [body, setBody] = useState(""),
    { commit, busy } = useProjectActions();
  async function send(event: FormEvent) {
    event.preventDefault();
    if (
      body.trim() &&
      (await commit({
        type: "comment.add",
        id: crypto.randomUUID(),
        taskId: task.id,
        body: body.trim(),
      }))
    )
      setBody("");
  }
  return (
    <section className="mt-7 border-t border-brand-line pt-6">
      <h3 className="mb-4 text-sm font-semibold">Comments</h3>
      <div className="space-y-3">
        {project.comments
          .filter((c) => c.taskId === task.id)
          .map((c) => (
            <article
              key={c.id}
              className="rounded-lg border border-brand-line bg-white p-3"
            >
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-semibold">{c.authorName}</span>
                <time className="text-brand-muted" dateTime={c.createdAt}>
                  {format(parseISO(c.createdAt), "MMM d, HH:mm")}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {c.body}
              </p>
            </article>
          ))}
      </div>
      <form onSubmit={send} className="mt-3 space-y-2">
        <textarea
          className={inputClass}
          aria-label="Write a comment"
          placeholder="Add a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          required
        />
        <Button
          type="submit"
          disabled={!body.trim() || busy || project.archived}
        >
          Post comment
        </Button>
      </form>
    </section>
  );
}
