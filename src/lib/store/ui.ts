"use client";

import { create } from "zustand";

interface UiStore {
  /** true while a test is actively running — chrome dims for focus */
  testRunning: boolean;
  setTestRunning: (v: boolean) => void;
}

export const useUi = create<UiStore>((set) => ({
  testRunning: false,
  setTestRunning: (testRunning) => {
    // drives the shared `.typing-chrome` fade in globals.css
    document.documentElement.toggleAttribute("data-typing", testRunning);
    set({ testRunning });
  },
}));
