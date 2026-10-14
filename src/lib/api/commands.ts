import { z } from "zod";
import { COLOR_KEYS } from "@/lib/types";
import { isDateOnly } from "@/lib/scheduling/dates";
const id = z.string().min(1).max(100),
  name = z.string().trim().min(1).max(160),
  date = z
    .string()
    .refine(isDateOnly, "Use a real date between 2000 and 2100")
    .nullable();
export const taskPatch = z
  .object({
    name: name.optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    percentComplete: z.number().int().min(0).max(100).optional(),
    color: z.enum(COLOR_KEYS).nullable().optional(),
    isMilestone: z.boolean().optional(),
    assigneeIds: z.array(id).max(50).optional(),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task.update"), id, patch: taskPatch }).strict(),
  z
    .object({
      type: z.literal("task.create"),
      id,
      name,
      groupId: id.nullable(),
      isMilestone: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal("task.delete"), id }).strict(),
  z
    .object({
      type: z.literal("task.reorder"),
      id,
      groupId: id.nullable(),
      beforeId: id.nullable(),
    })
    .strict(),
  z.object({ type: z.literal("group.create"), id, name }).strict(),
  z
    .object({
      type: z.literal("dependency.add"),
      id,
      predecessorTaskId: id,
      successorTaskId: id,
    })
    .strict(),
  z.object({ type: z.literal("dependency.remove"), id }).strict(),
  z
    .object({
      type: z.literal("comment.add"),
      id,
      taskId: id,
      body: z.string().trim().min(1).max(5000),
    })
    .strict(),
  z
    .object({
      type: z.literal("project.update"),
      name: name.optional(),
      color: z.enum(COLOR_KEYS).optional(),
      archived: z.boolean().optional(),
    })
    .strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const commandRequest = z
  .object({
    baseVersion: z.string().regex(/^[a-f0-9]{64}$/),
    command: commandSchema,
  })
  .strict();
export const createProjectSchema = z
  .object({ id, name, color: z.enum(COLOR_KEYS) })
  .strict();
