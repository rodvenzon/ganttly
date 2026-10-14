"use client";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, Check, X } from "lucide-react";
import {
  enrollPerson,
  fetchPeople,
  updatePerson,
  type EnrollInput,
  type PersonPatch,
} from "@/lib/api/client";
import { useMe, initialsOf } from "@/lib/api/use-me";
import { ALLOWED_EMAIL_DOMAIN, type Person } from "@/lib/types";
import { avatarClasses } from "@/lib/colors";
import { Shell } from "@/components/ui/Shell";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { useUI } from "@/store/ui";
const SITE = typeof location === "undefined" ? "" : location.origin;
export function PeopleAdmin() {
  const me = useMe(),
    isAdmin = me.data?.role === "super_admin";
  const people = useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
    enabled: isAdmin,
  });
  const [adding, setAdding] = useState(false);
  const active = people.data?.filter((p) => p.active) ?? [],
    inactive = people.data?.filter((p) => !p.active) ?? [];
  return (
    <Shell>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-3 text-xs tracking-[.22em] text-brand-muted">
                TEAM ACCESS
              </p>
              <h1 className="text-4xl font-medium tracking-tight">People</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-muted">
                Everyone here can sign in at {SITE.replace("https://", "")} with
                their email and be assigned to tasks. Only you can add people or
                remove their access.
              </p>
            </div>
            {isAdmin && !adding && (
              <Button variant="primary" onClick={() => setAdding(true)}>
                <UserPlus size={16} />
                Add person
              </Button>
            )}
          </div>
          {me.isPending ? (
            <p className="py-10 text-brand-muted">Loading…</p>
          ) : !isAdmin ? (
            <p className="mt-10 rounded-xl border border-dashed border-brand-line py-14 text-center text-brand-muted">
              Only the super admin can manage people.
            </p>
          ) : (
            <>
              {adding && <EnrollForm onDone={() => setAdding(false)} />}
              {people.isPending ? (
                <p className="py-10 text-brand-muted">Loading people…</p>
              ) : people.isError ? (
                <p className="py-10">{people.error.message}</p>
              ) : (
                <>
                  <PeopleList
                    title={`Enrolled · ${active.length}`}
                    people={active}
                    meId={me.data!.id}
                  />
                  {inactive.length > 0 && (
                    <PeopleList
                      title={`Access removed · ${inactive.length}`}
                      people={inactive}
                      meId={me.data!.id}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Toast />
    </Shell>
  );
}
function usePeopleMutation<T>(fn: (input: T) => Promise<Person | null>) {
  const cache = useQueryClient(),
    notify = useUI((s) => s.notify);
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["people"] });
      void cache.invalidateQueries({ queryKey: ["project"] });
      void cache.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => notify(e.message),
  });
}
function EnrollForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<EnrollInput>({
    name: "",
    title: "",
    email: "",
  });
  const notify = useUI((s) => s.notify);
  const enroll = usePeopleMutation(enrollPerson);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const person = await enroll.mutateAsync(form);
      notify(`${person?.name} can now sign in at ${SITE}`);
      onDone();
    } catch {
      /* shown by the mutation */
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-8 grid gap-4 rounded-xl border border-brand-line bg-white p-5 sm:grid-cols-[1fr_1fr_1.3fr_auto] sm:items-end"
    >
      <Field label="Name">
        <input
          required
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
          placeholder="Full name"
        />
      </Field>
      <Field label="Job title">
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={inputClass}
          placeholder="e.g. Graphic Designer"
        />
      </Field>
      <Field label="Sign-in email">
        <input
          required
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={inputClass}
          placeholder={`name@${ALLOWED_EMAIL_DOMAIN ?? "company.com"}`}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={enroll.isPending}>
          Enroll
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
function PeopleList({
  title,
  people,
  meId,
}: {
  title: string;
  people: Person[];
  meId: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xs font-semibold tracking-[.18em] text-brand-muted">
        {title.toUpperCase()}
      </h2>
      <ul className="divide-y divide-brand-line overflow-hidden rounded-xl border border-brand-line bg-white">
        {people.map((p) => (
          <PersonRow key={p.id} person={p} isMe={p.id === meId} />
        ))}
      </ul>
    </section>
  );
}
function PersonRow({ person, isMe }: { person: Person; isMe: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: person.name,
    title: person.title,
    email: person.email ?? "",
  });
  const update = usePeopleMutation((patch: PersonPatch) =>
    updatePerson(person.id, patch),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    const patch: PersonPatch = { name: form.name, title: form.title };
    if (!isMe) patch.email = form.email.trim() || null;
    try {
      await update.mutateAsync(patch);
      setEditing(false);
    } catch {
      /* shown by the mutation */
    }
  }
  const avatar = (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-medium ${avatarClasses[person.avatarColor]} ${person.active ? "" : "opacity-50"}`}
    >
      {initialsOf(person.name)}
    </span>
  );
  if (editing)
    return (
      <li className="p-4 sm:px-5">
        <form
          onSubmit={save}
          className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_1.3fr_auto] sm:items-center"
        >
          {avatar}
          <input
            aria-label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
          <input
            aria-label="Job title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
            placeholder="Job title"
          />
          <input
            aria-label="Sign-in email"
            type="email"
            value={form.email}
            disabled={isMe}
            title={isMe ? "You can't change your own sign-in email" : undefined}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
            placeholder={`name@${ALLOWED_EMAIL_DOMAIN ?? "company.com"}`}
          />
          <div className="flex gap-1">
            <Button
              type="submit"
              variant="primary"
              disabled={update.isPending}
              aria-label="Save"
            >
              <Check size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-label="Cancel"
              onClick={() => {
                setForm({
                  name: person.name,
                  title: person.title,
                  email: person.email ?? "",
                });
                setEditing(false);
              }}
            >
              <X size={16} />
            </Button>
          </div>
        </form>
      </li>
    );
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_14rem] sm:px-5">
      {avatar}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          {person.name}
          {person.role === "super_admin" && (
            <span className="rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-semibold tracking-wider">
              SUPER ADMIN
            </span>
          )}
          {isMe && <span className="text-xs text-brand-muted">(you)</span>}
        </p>
        <p className="text-sm text-brand-muted">{person.title || "No title"}</p>
      </div>
      <p
        className={`col-start-2 min-w-0 truncate text-sm sm:col-start-auto ${person.email ? "" : "italic text-brand-muted"}`}
      >
        {person.email ?? "No sign-in email yet"}
      </p>
      <div className="col-start-2 -ml-3 flex gap-2 sm:col-start-auto sm:ml-0 sm:justify-end">
        <Button variant="ghost" onClick={() => setEditing(true)}>
          <Pencil size={14} />
          Edit
        </Button>
        {!isMe && (
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({ active: !person.active })}
          >
            {person.active ? "Remove access" : "Restore access"}
          </Button>
        )}
      </div>
    </li>
  );
}
