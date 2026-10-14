"use client";
import { useState } from "react";
import { format } from "date-fns";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchProject, fetchProjects } from "@/lib/api/client";
import { useMe } from "@/lib/api/use-me";
import { useUI } from "@/store/ui";
/**
 * Downloads an Excel report: one project when `projectId` is given,
 * otherwise every active project. The Excel library loads only on click.
 */
export function ExportReport({ projectId }: { projectId?: string }) {
  const [busy, setBusy] = useState(false),
    me = useMe(),
    notify = useUI((s) => s.notify);
  async function run() {
    setBusy(true);
    try {
      const projects = projectId
        ? [(await fetchProject(projectId)).project]
        : await Promise.all(
            (await fetchProjects())
              .filter((p) => !p.archived)
              .map(async (p) => (await fetchProject(p.id)).project),
          );
      const title = projectId ? projects[0].name : "All active projects";
      const today = format(new Date(), "yyyy-MM-dd");
      const { buildReport, reportFileName } =
        await import("@/lib/report/report");
      const data = await buildReport({
        projects,
        title,
        generatedBy: me.data?.name ?? "Ganttly",
        today,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const url = URL.createObjectURL(
        new Blob([data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = reportFileName(title, today);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't create the report");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button onClick={run} disabled={busy} title="Download an Excel report">
      <FileSpreadsheet size={16} />
      {busy ? "Preparing…" : "Export to Excel"}
    </Button>
  );
}
