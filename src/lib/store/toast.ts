"use client";

import { create } from "zustand";

export type ToastTone = "danger" | "info";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: Toast[];
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Fire a top-right notification; auto-dismisses. Same message never stacks. */
export function toast(message: string, tone: ToastTone = "danger", ms = 6000) {
  const id = nextId++;
  useToasts.setState((s) => ({
    toasts: [...s.toasts.filter((t) => t.message !== message), { id, message, tone }],
  }));
  setTimeout(() => useToasts.getState().dismiss(id), ms);
}
