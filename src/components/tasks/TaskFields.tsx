import { useState, type FormEvent } from "react";
import type { Task, ProjectDetail } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { useProjectActions } from "@/lib/api/use-project-actions";
import { useUI } from "@/store/ui";
import { assertRange } from "@/lib/scheduling/dates";
import { avatarClasses } from "@/lib/colors";
import { ColorPicker } from "@/components/ui/ColorPicker";
export function TaskFields({
  task,
  project,
}: {
  task: Task;
  project: ProjectDetail;
}) {
  const [form, setForm] = useState({
    name: task.name,
    startDate: task.startDate ?? "",
    endDate: task.endDate ?? "",
    percentComplete: task.percentComplete,
    isMilestone: task.isMilestone,
    color: task.color,
    assigneeIds: task.assigneeIds,
  });
  const { commit, busy } = useProjectActions(),
    notify = useUI((s) => s.notify);
  async function save(event: FormEvent) {
    event.preventDefault();
    const startDate = form.startDate || null,
      endDate = form.isMilestone ? startDate : form.endDate || null;
    try {
      assertRange(startDate, endDate, form.isMilestone);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Invalid dates");
      return;
    }
    if (
      await commit({
        type: "task.update",
        id: task.id,
        patch: { ...form, name: form.name.trim(), startDate, endDate },
      })
    )
      notify("Task saved");
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Task name">
        <input
          className={inputClass}
          required
          maxLength={160}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input
            className={inputClass}
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </Field>
        <Field label={form.isMilestone ? "Milestone date" : "End date"}>
          <input
            className={inputClass}
            type="date"
            min={form.startDate || "2000-01-01"}
            max="2100-12-31"
            disabled={form.isMilestone}
            value={form.isMilestone ? form.startDate : form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-between gap-3 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isMilestone}
            onChange={(e) =>
              setForm({
                ...form,
                isMilestone: e.target.checked,
                endDate: form.startDate,
              })
            }
          />
          Milestone
        </label>
        <button
          type="button"
          className="text-brand-muted underline"
          onClick={() => setForm({ ...form, startDate: "", endDate: "" })}
        >
          Clear schedule
        </button>
      </div>
      <Field label={`Progress · ${form.percentComplete}%`}>
        <input
          type="range"
          min={0}
          max={100}
          value={form.percentComplete}
          className="w-full accent-brand-accent"
          onChange={(e) =>
            setForm({ ...form, percentComplete: Number(e.target.value) })
          }
        />
      </Field>
      <div className="flex flex-col gap-2 text-xs font-medium text-brand-muted">
        Bar colour
        <ColorPicker
          allowNone
          value={form.color}
          onChange={(color) => setForm({ ...form, color })}
        />
      </div>
      <fieldset>
        <legend className="mb-3 text-xs font-medium text-brand-muted">
          Assignees
        </legend>
        <div className="flex flex-wrap gap-2">
          {project.assignees
            .filter((a) => a.active || task.assigneeIds.includes(a.id))
            .map((a) => (
              <label
                key={a.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs ${form.assigneeIds.includes(a.id) ? "border-brand-accent bg-brand-soft" : "border-brand-line bg-white"}`}
              >
                <input
                  type="checkbox"
                  checked={form.assigneeIds.includes(a.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assigneeIds: e.target.checked
                        ? [...form.assigneeIds, a.id]
                        : form.assigneeIds.filter((id) => id !== a.id),
                    })
                  }
                />
                <span
                  className={`h-2 w-2 rounded-full ${avatarClasses[a.avatarColor]}`}
                />
                {a.name}
                {!a.active && (
                  <span className="text-brand-muted">(no access)</span>
                )}
              </label>
            ))}
        </div>
      </fieldset>
      <Button
        type="submit"
        variant="primary"
        disabled={busy || project.archived}
        className="w-full"
      >
        {busy ? "Saving…" : "Save task"}
      </Button>
    </form>
  );
}
