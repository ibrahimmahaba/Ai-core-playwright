import { useState } from "react";
import type { ScreenshotResponse, Step, UseSendStepParams } from "../types";
import { runPixel } from "@semoss/sdk";

  
  export function useSendStep({
    sessionId,
    insightId,
    shot: externalShot,
    setShot: externalSetShot,
    steps: externalSteps,
    setSteps: externalSetSteps,
    setLoading: externalSetLoading,
  }: UseSendStepParams) {
    const [internalShot, internalSetShot] = useState<ScreenshotResponse | undefined>(undefined);
    const [internalSteps, internalSetSteps] = useState<Step[]>([]);
    const [internalLoading, internalSetLoading] = useState(false);
  
    const shot = externalShot ?? internalShot;
    const setShot = externalSetShot ?? internalSetShot;
  
    const steps = externalSteps ?? internalSteps;
    const setSteps = externalSetSteps ?? internalSetSteps;
  
    const setLoading = externalSetLoading ?? internalSetLoading;
  
    async function sendStep(step: Step) {
      if (!sessionId) return;
      const shouldStore = step.type === "TYPE" && step.storeValue;
      setLoading(true);
      try {
        const pixel = `Step ( sessionId = "${sessionId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0];
        const data: ScreenshotResponse = output as ScreenshotResponse;
        setShot(data);
        setSteps(prev => [...prev, step]);
      } finally {
        setLoading(false);
      }
    }
  
    return { sendStep };
  }