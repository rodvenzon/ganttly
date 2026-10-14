import { ProjectRoute } from "@/components/projects/ProjectRoute";
// The Cloudflare build is a static export: it prerenders one shell at
// /projects/_ and the worker serves it for every project address.
// ProjectRoute then reads the real id from the address bar.
export function generateStaticParams() {
  return [{ id: "_" }];
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectRoute id={id} />;
}
