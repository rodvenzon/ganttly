"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Users, LockKeyhole, RotateCcw } from "lucide-react";
import { Brand } from "./Brand";
import { Button } from "./Button";
import { useMe, useDemo, initialsOf } from "@/lib/api/use-me";
import { RequestError, resetDemo } from "@/lib/api/client";
import { avatarClasses } from "@/lib/colors";
export function Shell({ children }: { children: React.ReactNode }) {
  const me = useMe(),
    demo = useDemo(),
    user = demo ? null : me.data,
    blocked =
      me.error instanceof RequestError &&
      (me.error.status === 401 || me.error.status === 403)
        ? me.error
        : null;
  return (
    <div className="flex h-dvh min-h-[500px] flex-col print:block print:h-auto print:min-h-0">
      <header className="flex h-24 shrink-0 print:hidden items-center justify-between border-b border-brand-line bg-brand-stone px-5 sm:px-8">
        <Link href="/" aria-label="Ganttly projects">
          <Brand />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {!blocked && (
            <Link
              href="/"
              className="flex items-center gap-2 text-brand-muted hover:text-brand-ink"
            >
              <FolderOpen size={17} />
              Projects
            </Link>
          )}
          {user?.role === "super_admin" && (
            <Link
              href="/people"
              className="flex items-center gap-2 text-brand-muted hover:text-brand-ink"
            >
              <Users size={17} />
              People
            </Link>
          )}
          {demo ? (
            <ResetDemo />
          ) : (
            <span className="hidden border-l border-brand-line pl-5 text-brand-muted sm:block">
              Project workspace
            </span>
          )}
          {user && (
            <span
              title={user.title ? `${user.name} · ${user.title}` : user.name}
              aria-label={`Signed in as ${user.name}`}
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-medium ${avatarClasses[user.avatarColor]}`}
            >
              {initialsOf(user.name)}
            </span>
          )}
        </nav>
      </header>
      {demo && (
        <p className="shrink-0 border-b border-brand-line bg-brand-soft print:hidden px-5 py-2 text-center text-xs text-brand-ink sm:px-8">
          <span className="mr-2 rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white">
            LIVE DEMO
          </span>
          No sign-up needed. Your projects are private to this browser and clear
          after {demo.ttlDays} days.
        </p>
      )}
      {blocked ? <NotEnrolled message={blocked.message} /> : children}
    </div>
  );
}
function NotEnrolled({ message }: { message: string }) {
  return (
    <main className="grid flex-1 place-items-center px-5">
      <div className="max-w-md text-center">
        <LockKeyhole size={30} className="mx-auto mb-5 text-brand-muted" />
        <h1 className="mb-3 text-2xl font-medium">Not enrolled yet</h1>
        <p className="mb-6 text-sm leading-relaxed text-brand-muted">
          {message}
        </p>
        <Button onClick={() => location.reload()}>Try again</Button>
      </div>
    </main>
  );
}
function ResetDemo() {
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false);
  const cache = useQueryClient(),
    router = useRouter();
  async function reset() {
    setBusy(true);
    try {
      await resetDemo();
      cache.removeQueries({ queryKey: ["project"] });
      await cache.invalidateQueries({ queryKey: ["projects"] });
      router.push("/");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }
  if (!confirming)
    return (
      <Button
        variant="ghost"
        aria-label="Reset demo"
        onClick={() => setConfirming(true)}
      >
        <RotateCcw size={15} />
        <span className="hidden sm:inline">Reset demo</span>
      </Button>
    );
  return (
    <span className="flex items-center gap-2">
      <span className="hidden text-brand-muted md:inline">
        Start over with the sample project?
      </span>
      <Button variant="primary" disabled={busy} onClick={reset}>
        Reset
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}
