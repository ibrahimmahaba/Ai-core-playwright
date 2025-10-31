import type { ScreenshotResponse, Step } from "../types";
import { runPixel } from "@semoss/sdk";
import { useSessionStore } from "../store/useSessionStore";
import { fetchScreenshot } from "./useFetchScreenshot";


export function useSendStep() {

  async function sendStep(step: Step, tabId?: string) {
    const { sessionId, insightId, setShot, tabs, setTabs, activeTabId, setActiveTabId, setLoading } = useSessionStore.getState();
    const currentTabId = tabId || activeTabId;

    if (!sessionId || !tabs) {
      console.warn("Cannot send step: session not initialized", { sessionId, tabs });
      return;
    }

    const shouldStore = step.type === "TYPE" && step.storeValue;
    setLoading(true);

    try {
      const pixel = `Step ( sessionId = "${sessionId}", tabId="${currentTabId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
      
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0] as any;
      
      const data: ScreenshotResponse = output["screenshot"] as ScreenshotResponse;
      const isNewTab: boolean = output["isNewTab"] as boolean;
      const newTabId: string | undefined = output["newTabId"] as string | undefined;
      const tabTitle: string = output["tabTitle"] as string;
      
      
      setShot(data);


      setTabs(prevTabs => {
        const updatedTabs = prevTabs.map(tab => {
          if (tab.id === currentTabId) {
            return {
              ...tab,
              steps: [...tab.steps, step],
              title: step.type === "NAVIGATE" && tabTitle ? tabTitle : tab.title
            };
          }
          return tab;
        });

        if (isNewTab && newTabId && !updatedTabs.find(t => t.id === newTabId)) {
          const newTab = {
            id: newTabId,
            title: tabTitle || newTabId,
            steps: []
          };
          return [...updatedTabs, newTab];
        }

        return updatedTabs;
      });

      if (isNewTab && newTabId) {
        setActiveTabId(newTabId);
      }
      
    } catch (error) {
      console.error("Error sending step:", error);
      console.error("Step details:", { step, sessionId, currentTabId });
      // Try to fetch screenshot even on error to avoid white screen
      try {
        const { sessionId, insightId, setShot } = useSessionStore.getState();
        await fetchScreenshot(sessionId, insightId, currentTabId, setShot);
      } catch (fetchError) {
        console.error("Failed to fetch screenshot after error:", fetchError);
      }
    } finally {
      setLoading(false);
    }
  }

  return { sendStep };
}
