import { useState, type FormEvent } from "react";
import type { ProjectSummary, ColorKey } from "@/lib/types";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Drawer } from "@/components/ui/Drawer";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useProjectList } from "@/lib/api/use-project-list";
export function ProjectForm({
  project,
  onClose,
}: {
  project: ProjectSummary | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(project?.name ?? ""),
    [color, setColor] = useState<ColorKey>(project?.color ?? "lagoon"),
    [skipWeekends, setSkipWeekends] = useState(project?.skipWeekends ?? true);
  const { save, busy } = useProjectList();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      await save(
        project
          ? {
              type: "update",
              id: project.id,
              name: name.trim(),
              color,
              ...(skipWeekends !== project.skipWeekends && { skipWeekends }),
            }
          : {
              type: "create",
              id: crypto.randomUUID(),
              name: name.trim(),
              color,
              skipWeekends,
            },
      )
    )
      onClose();
  }
  return (
    <Drawer
      open
      onClose={onClose}
      title={project ? "Edit project" : "A new beginning"}
      description={
        project
          ? "Update the name, colour and working days."
          : "Give your next project a name, then shape the plan."
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Project name">
          <input
            className={inputClass}
            autoFocus
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website relaunch"
          />
        </Field>
        <div className="flex flex-col gap-2 text-xs font-medium text-brand-muted">
          Timeline colour
          <ColorPicker value={color} onChange={(c) => c && setColor(c)} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-line bg-white p-3">
          <input
            type="checkbox"
            checked={skipWeekends}
            onChange={(e) => setSkipWeekends(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-accent"
          />
          <span className="text-sm">
            <span className="font-medium">Skip weekends</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-brand-muted">
              Count working days only. Tasks start and end on weekdays, and
              linked tasks move to the next weekday.
              {project && skipWeekends !== project.skipWeekends && (
                <span className="mt-1 block text-brand-ink">
                  {skipWeekends
                    ? "Tasks that start or end on a weekend will move onto weekdays when you save."
                    : "Existing dates stay as they are; new moves will count every day."}
                </span>
              )}
            </span>
          </span>
        </label>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !name.trim()}
          className="w-full"
        >
          {busy ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
      </form>
    </Drawer>
  );
}
