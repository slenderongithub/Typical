"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { GazeStatusKind } from "@/lib/types";

import { GazeController } from "./controller";

interface GazeStore {
  /** getUserMedia + Worker available — detected on the client after mount */
  supported: boolean;
  /** user accepted the consent screen (persisted) */
  consented: boolean;
  cameraOn: boolean;
  status: GazeStatusKind;
  calibrated: boolean;
  error?: string;
  detectSupport: () => void;
  setConsented: (v: boolean) => void;
  setCameraOn: (v: boolean) => void;
  setStatus: (s: GazeStatusKind) => void;
  setCalibrated: (v: boolean) => void;
  setError: (msg?: string) => void;
}

export const useGazeStore = create<GazeStore>()(
  persist(
    (set) => ({
      supported: false,
      consented: false,
      cameraOn: false,
      status: "inactive",
      calibrated: false,
      error: undefined,
      detectSupport: () => set({ supported: GazeController.isSupported() }),
      setConsented: (consented) => set({ consented }),
      setCameraOn: (cameraOn) => set({ cameraOn }),
      setStatus: (status) => set({ status }),
      setCalibrated: (calibrated) => set({ calibrated }),
      setError: (error) => set({ error }),
    }),
    {
      name: "nolook:gaze",
      // only the consent decision persists — camera/calibration are per-session
      partialize: (s) => ({ consented: s.consented }),
    },
  ),
);

let controller: GazeController | null = null;

/** Lazy client-only singleton — the one live gaze pipeline for the tab. */
export function getController(): GazeController {
  if (!controller) controller = new GazeController();
  return controller;
}
