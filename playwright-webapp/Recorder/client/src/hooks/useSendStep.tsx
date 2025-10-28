import type { ScreenshotResponse, Step, UseSendStepParams } from "../types";
import { runPixel } from "@semoss/sdk";
import { useSessionStore } from "../store/useSessionStore";

  
export function useSendStep({
  insightId,
  setSteps: externalSetSteps,
  setLoading: externalSetLoading,
}: UseSendStepParams) {
  const setSteps = externalSetSteps;
  const setLoading = externalSetLoading;

  async function sendStep(step: Step) {
    // Get sessionId and setShot from store at call time, not hook initialization time
    const { sessionId, setShot } = useSessionStore.getState();

    if (!sessionId) return;
    const shouldStore = step.type === "TYPE" && step.storeValue;
    setLoading?.(true);
    try {
      const pixel = `Step ( sessionId = "${sessionId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0];
      const data: ScreenshotResponse = output as ScreenshotResponse;
      setShot(data);
      setSteps?.(prev => [...prev, step]);
    } finally {
      setLoading?.(false);
    }
  }

  return { sendStep };
}