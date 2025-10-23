import { useState } from "react";
import type { ScreenshotResponse, Step, UseSendStepParams } from "../types";
import { runPixel } from "@semoss/sdk";

  
export function useSendStep({
  sessionId,
  insightId,
  setShot: externalSetShot,
  setSteps: externalSetSteps,
  setLoading: externalSetLoading,
  tabs,
  setTabs: externalSetTabs,
  setActiveTab: externalSetActiveTab,
}: UseSendStepParams) {
  const [, internalSetShot] = useState<ScreenshotResponse | undefined>(undefined);
  const [, internalSetSteps] = useState<Step[]>([]);
  const [, internalSetLoading] = useState<boolean>(false);
  const [, internalSetTabs] = useState<{ id: number; title: string }[]>([]);
  const [, internalSetActiveTab] = useState<number>(0);

  const setShot = externalSetShot ?? internalSetShot;
  const setSteps = externalSetSteps ?? internalSetSteps;
  const setLoading = externalSetLoading ?? internalSetLoading;
  const setTabs = externalSetTabs ?? internalSetTabs;
  const setActiveTab = externalSetActiveTab ?? internalSetActiveTab;

  async function sendStep(step: Step, tabId: number, isNavigate: boolean = false) {
    if (!sessionId) return;
    const shouldStore = step.type === "TYPE" && step.storeValue;
    setLoading(true);
    try {
      const pixel = `Step ( sessionId = "${sessionId}", tabId="tab-${tabId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0] as any;
      const data: ScreenshotResponse = output["screenshot"] as ScreenshotResponse;
      const isNewTab: boolean = output["isNewTab"] as boolean;
      if (isNewTab) 
      {
        const tabTitle: string = output["tabTitle"] as string;
        setTabs([...tabs!, { id: tabId, title: tabTitle }]);
        setActiveTab(tabs!.length);
      }
      if(isNavigate){
        setTabs(prevTabs => prevTabs.map(tab => tab.id === tabId ? { ...tab, title: output["tabTitle"] as string } : tab));
        console.log("Updated tab title after navigation", tabs);
      }
      setShot(data);
      setSteps(prev => [...prev, step]);
    } finally {
      setLoading(false);
    }
  }

  return { sendStep };
}