import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import type { ProjectDetail } from "@/lib/types";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { useProjectActions } from "@/lib/api/use-project-actions";
import { useUI } from "@/store/ui";
export function AddWork({ project }: { project: ProjectDetail }) {
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState("task"),
    [name, setName] = useState(""),
    [group, setGroup] = useState(project.groups[0]?.id ?? "");
  const { commit, busy } = useProjectActions(),
    select = useUI((s) => s.selectTask);
  async function add(event: FormEvent) {
    event.preventDefault();
    const id = crypto.randomUUID();
    const ok = await commit(
      kind === "group"
        ? { type: "group.create", id, name }
        : {
            type: "task.create",
            id,
            name,
            groupId: group || null,
            isMilestone: kind === "milestone",
          },
    );
    if (ok) {
      setOpen(false);
      setName("");
      if (kind !== "group") select(id);
    }
  }
  return (
    <>
      <Button
        variant="primary"
        disabled={project.archived}
        onClick={() => setOpen(true)}
      >
        <Plus size={15} />
        Add work
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Add to the plan"
        description="Create a task, milestone, or phase."
      >
        <form onSubmit={add} className="space-y-5">
          <Field label="Type">
            <select
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="task">Task</option>
              <option value="milestone">Milestone</option>
              <option value="group">Phase</option>
            </select>
          </Field>
          <Field label="Name">
            <input
              autoFocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
            />
          </Field>
          {kind !== "group" && (
            <Field label="Phase">
              <select
                className={inputClass}
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="">Ungrouped</option>
                {project.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !name.trim()}
            className="w-full"
          >
            {busy ? "Creating…" : "Create " + kind}
          </Button>
        </form>
      </Drawer>
    </>
  );
}
