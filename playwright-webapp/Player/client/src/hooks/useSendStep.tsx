import { useState } from "react";
import type { ScreenshotResponse, Step, UseSendStepParams, TabData } from "../types";
import { runPixel } from "@semoss/sdk";

export function useSendStep({
  sessionId,
  insightId,
  setShot: externalSetShot,
  setLoading: externalSetLoading,
  tabs,
  setTabs: externalSetTabs,
  setActiveTabId: externalSetActiveTabId,
}: UseSendStepParams) {
  const [, internalSetShot] = useState<ScreenshotResponse | undefined>(undefined);
  const [, internalSetLoading] = useState<boolean>(false);
  const [, internalSetTabs] = useState<TabData[]>([]);
  const [, internalSetActiveTabId] = useState<string>("tab-1");

  const setShot = externalSetShot ?? internalSetShot;
  const setLoading = externalSetLoading ?? internalSetLoading;
  const setTabs = externalSetTabs ?? internalSetTabs;
  const setActiveTabId = externalSetActiveTabId ?? internalSetActiveTabId;

  async function sendStep(step: Step, tabId: string, isNavigate: boolean = false) {
    if (!sessionId || !tabs) return;
    
    const shouldStore = step.type === "TYPE" && step.storeValue;
    setLoading(true);
    
    try {
      const pixel = `Step ( sessionId = "${sessionId}", tabId="${tabId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
      console.log("Sending pixel:", pixel);
      
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0] as any;
      
      const data: ScreenshotResponse = output["screenshot"] as ScreenshotResponse;
      const isNewTab: boolean = output["isNewTab"] as boolean;
      const newTabId: string | undefined = output["newTabId"] as string | undefined;
      const tabTitle: string = output["tabTitle"] as string;
      
      console.log("Step response:", { isNewTab, newTabId, tabTitle });
      
      setShot(data);
      
      // Update tabs
      setTabs(prevTabs => {
        const updatedTabs = prevTabs.map(tab => {
          if (tab.id === tabId) {
            // Add step to current tab
            return {
              ...tab,
              steps: [...tab.actions, step],
              title: isNavigate && tabTitle ? tabTitle : tab.title
            };
          }
          return tab;
        });
        
        // If new tab was opened, add it
        if (isNewTab && newTabId && !updatedTabs.find(t => t.id === newTabId)) {
          const newTab: TabData = {
            id: newTabId,
            title: tabTitle || newTabId,
            actions: []
          };
          return [...updatedTabs, newTab];
        }
        
        return updatedTabs;
      });
      
      // Switch to new tab if one was opened
      if (isNewTab && newTabId) {
        setActiveTabId(newTabId);
      }
      
    } catch (error) {
      console.error("Error sending step:", error);
    } finally {
      setLoading(false);
    }
  }

  return { sendStep };
}