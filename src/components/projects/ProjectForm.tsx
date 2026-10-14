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
    [color, setColor] = useState<ColorKey>(project?.color ?? "lagoon");
  const { save, busy } = useProjectList();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      await save(
        project
          ? { type: "update", id: project.id, name: name.trim(), color }
          : {
              type: "create",
              id: crypto.randomUUID(),
              name: name.trim(),
              color,
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
          ? "Update the name and timeline colour."
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
