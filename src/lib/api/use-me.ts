"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, type MeEnvelope } from "./client";
const meQuery = {
  queryKey: ["me"],
  queryFn: fetchMe,
  staleTime: 5 * 60 * 1000,
  retry: false,
} as const;
/** The signed-in person (or the demo guest). */
export function useMe() {
  return useQuery({ ...meQuery, select: (r: MeEnvelope) => r.user });
}
/** Demo settings when this is the public demo, otherwise null. */
export function useDemo() {
  return useQuery({ ...meQuery, select: (r: MeEnvelope) => r.demo ?? null })
    .data;
}
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
