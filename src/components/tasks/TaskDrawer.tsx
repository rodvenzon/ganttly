import type { ProjectDetail } from "@/lib/types";
import { useUI } from "@/store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useProjectActions } from "@/lib/api/use-project-actions";
import { TaskFields } from "./TaskFields";
import { TaskDependencies } from "./TaskDependencies";
import { TaskComments } from "./TaskComments";
export function TaskDrawer({ project }: { project: ProjectDetail }) {
  const { selectedTaskId, selectTask } = useUI(),
    { commit, busy } = useProjectActions();
  const task = project.tasks.find((t) => t.id === selectedTaskId);
  return (
    <Drawer
      open={!!task}
      onClose={() => selectTask(null)}
      title="Task details"
      description="Plan the work, connect the sequence, and keep context together."
    >
      {task && (
        <>
          <TaskFields
            key={task.id + JSON.stringify(task)}
            task={task}
            project={project}
          />
          <TaskDependencies task={task} project={project} />
          <TaskComments key={task.id} task={task} project={project} />
          <div className="mt-8 border-t border-brand-line pt-5">
            <Button
              className="text-brand-error"
              disabled={busy || project.archived}
              onClick={async () => {
                if (
                  window.confirm(
                    `Delete “${task.name}” and its comments and dependencies?`,
                  ) &&
                  (await commit({ type: "task.delete", id: task.id }))
                )
                  selectTask(null);
              }}
            >
              Delete task
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
}
