import type { Coords, Probe } from "../types";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../utils/errorHandler";

export async function useProbeAt(pendingCoords: Coords | null, sessionId: string, insightId: string, activeTabId: string) {
    if (!sessionId) return;
    if (!pendingCoords) alert("Invalid Coordinates");

    let pixel = `ProbeElement (sessionId = "${sessionId}" , coords = "${pendingCoords?.x}, ${pendingCoords?.y}", tabId = "${activeTabId}");`
    const res = await runPixel(pixel, insightId);
    
    if (checkSessionExpired(res.pixelReturn)) {
      return;
    }
    
    const { output } = res.pixelReturn[0] as { output: Probe };
    console.log(output)
    return output;

  }