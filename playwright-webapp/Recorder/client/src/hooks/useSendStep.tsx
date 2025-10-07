import { useState } from "react";
import type { ScreenshotResponse, Step, UseSendStepParams } from "../types";
import { runPixel } from "@semoss/sdk";

  
export function useSendStep({
  sessionId,
  insightId,
  setShot: externalSetShot,
  setSteps: externalSetSteps,
  setLoading: externalSetLoading,
}: UseSendStepParams) {
  const [, internalSetShot] = useState<ScreenshotResponse | undefined>(undefined);
  const [, internalSetSteps] = useState<Step[]>([]);
  const [, internalSetLoading] = useState<boolean>(false);

  const setShot = externalSetShot ?? internalSetShot;
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