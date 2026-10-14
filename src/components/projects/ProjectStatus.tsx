import { useProjectActions } from "@/lib/api/use-project-actions";
import { Button } from "@/components/ui/Button";
export function ProjectStatus({ archived }: { archived: boolean }) {
  const { commit, busy } = useProjectActions();
  return archived ? (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-line bg-brand-offwhite px-4 py-2 text-sm">
      <span>This project is archived.</span>
      <Button
        disabled={busy}
        onClick={() => void commit({ type: "project.update", archived: false })}
      >
        Restore project
      </Button>
    </div>
  ) : (
    <p role="status" className="mb-3 text-right text-[11px] text-brand-muted">
      {busy ? "Saving changes…" : "Saved to workspace"}
    </p>
  );
}
