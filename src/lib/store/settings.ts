"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  type AppSettings,
  type TestConfig,
  DEFAULT_SETTINGS,
} from "@/lib/types";

interface SettingsStore extends AppSettings {
  set: (patch: Partial<AppSettings>) => void;
  setDefaultConfig: (config: TestConfig) => void;
}

/** Persisted app settings — safe to read from any client component. */
export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setDefaultConfig: (defaultConfig) => set({ defaultConfig }),
    }),
    { name: "nolook:settings" },
  ),
);
