"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
/** Opens the browser's print dialog; "Save as PDF" there makes the PDF. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} title="Print, or save as PDF">
      <Printer size={16} />
      Print / PDF
    </Button>
  );
}
