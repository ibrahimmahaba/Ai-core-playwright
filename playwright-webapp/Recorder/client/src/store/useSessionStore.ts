import { create } from "zustand";
import { runPixel } from "@semoss/sdk";
import type { ScreenshotResponse } from "../types";


interface SessionStore {
  insightId: string;
  setInsightId: (id: string) => void;

  sessionId: string;
  setSessionId: (sessionId: string) => void;

  isInitialized: boolean;
  setIsInitialized: (init: boolean) => void;

  shot?: ScreenshotResponse;
  setShot: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;

  initSession: (insightId: string, isInitialized: boolean) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set) => ({
  insightId: "",
  sessionId: "",
  isInitialized: false,
  shot: undefined,

  setInsightId: (id) => set({ insightId: id }),
  setSessionId: (id) => set({ sessionId: id }),
  setIsInitialized: (val) => set({ isInitialized: val }),

  setShot: (value) =>
    set((state) => ({
      shot: typeof value === "function" ? value(state.shot) : value,
    })),

  initSession: async (insightId, isInitialized) => {
    try {
      if (!isInitialized) {
        console.log("Waiting for initialization...");
        return;
      }

      const res = await runPixel(`Session()`, insightId);
      const { output } = res.pixelReturn[0];
      console.log("Session initialized:", output);

      set({
        insightId,
        sessionId: output as string,
        isInitialized: true,
      });
    } catch (err) {
      console.error("Error initializing session:", err);
    }
  },
}));
