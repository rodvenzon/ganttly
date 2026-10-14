import { Providers } from "@/components/ui/Providers";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Ganttly",
  description: "Plan projects on one timeline. Drag, link and share.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
