import { create } from "zustand";
import type { Task } from "@/lib/types";
import type { Zoom } from "@/lib/scheduling/constants";
interface UIState {
  zoom: Zoom;
  collapsed: string[];
  selectedTaskId: string | null;
  preview: Task[] | null;
  toast: string;
  setZoom: (z: Zoom) => void;
  toggleGroup: (id: string) => void;
  selectTask: (id: string | null) => void;
  setPreview: (tasks: Task[] | null) => void;
  notify: (message: string) => void;
}
export const useUI = create<UIState>((set) => ({
  zoom: "week",
  collapsed: [],
  selectedTaskId: null,
  preview: null,
  toast: "",
  setZoom: (zoom) => set({ zoom }),
  toggleGroup: (id) =>
    set((s) => ({
      collapsed: s.collapsed.includes(id)
        ? s.collapsed.filter((x) => x !== id)
        : [...s.collapsed, id],
    })),
  selectTask: (selectedTaskId) => set({ selectedTaskId }),
  setPreview: (preview) => set({ preview }),
  notify: (toast) => set({ toast }),
}));
