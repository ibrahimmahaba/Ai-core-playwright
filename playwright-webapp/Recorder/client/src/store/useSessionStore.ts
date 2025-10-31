import { create } from "zustand";
import { runPixel } from "@semoss/sdk";
import type { ModelOption, ScreenshotResponse, TabData } from "../types";


interface SessionStore {
  insightId: string;
  setInsightId: (id: string) => void;

  sessionId: string;
  setSessionId: (sessionId: string) => void;

  isInitialized: boolean;
  setIsInitialized: (init: boolean) => void;

  shot?: ScreenshotResponse;
  setShot: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;

  loading: boolean;
  setLoading: (loading: boolean) => void;

  tabs: TabData[];
  setTabs: (tabs: TabData[] | ((prev: TabData[]) => TabData[])) => void;

  activeTabId: string;
  setActiveTabId: (id: string) => void;

  mode: string;
  setMode: (mode: string) => void;

  selectedModel: ModelOption | null;
  setSelectedModel: (model: ModelOption | null) => void;

  title: string;
  setTitle: (title: string) => void;

  description: string;
  setDescription: (description: string) => void;

  initSession: (insightId: string, isInitialized: boolean) => Promise<void>;
  resetSession: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  insightId: "",
  sessionId: "",
  isInitialized: false,
  shot: undefined,

  loading: false,
  tabs: [{ id: "tab-1", title: "tab-1", steps: [] }],
  activeTabId: "tab-1",
  mode: "click",
  selectedModel: null,

  title: "",
  description: "",

  setInsightId: (id) => set({ insightId: id }),
  setSessionId: (id) => set({ sessionId: id }),
  setIsInitialized: (val) => set({ isInitialized: val }),

  setShot: (value) =>
    set((state) => ({
      shot: typeof value === "function" ? value(state.shot) : value,
    })),

  setLoading: (loading) => set({ loading }),

  setTabs: (value) =>
    set((state) => ({
      tabs: typeof value === "function" ? value(state.tabs) : value,
    })),

  setActiveTabId: (id) => set({ activeTabId: id }),
  setMode: (mode) => set({ mode }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  // MEDIUM PRIORITY Setters
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),

  initSession: async (insightId, isInitialized) => {
    try {
      if (!isInitialized) {
        return;
      }

      const res = await runPixel(`Session()`, insightId);
      const { output } = res.pixelReturn[0];

      set({
        insightId,
        sessionId: output as string,
        isInitialized: true,
      });
    } catch (err) {
      console.error("Error initializing session:", err);
    }
  },

  resetSession: () => {
    set({
      // sessionId: "",
      shot: undefined,
      tabs: [{ id: "tab-1", title: "tab-1", steps: [] }],
      activeTabId: "tab-1",
      title: "",
      description: "",
      mode: "click",
      // loading: false,
    });
  },
}));
