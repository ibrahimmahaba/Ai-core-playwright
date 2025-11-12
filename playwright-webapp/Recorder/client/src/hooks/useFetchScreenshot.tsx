import type { ScreenshotResponse } from "../types";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../utils/errorHandler";


export async function fetchScreenshot(sessionId: string, insightId: string, activeTabId: string, setShot: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>) {
    if (!sessionId) return;
    try {
        let pixel = `Screenshot ( sessionId = "${sessionId}", tabId="${activeTabId}" )`;
        const res = await runPixel(pixel, insightId);
        
        if (checkSessionExpired(res.pixelReturn)) {
          return;
        }
        
        const { output } = res.pixelReturn[0];
        const snap = normalizeShot(output);
        if (snap) setShot(snap);
    } catch (err) {
        console.error("fetchScreenshot error:", err);
    }
}

function normalizeShot(raw: any | undefined | null): ScreenshotResponse | undefined {
    if (!raw) return undefined;
    const base64 =
      raw.base64Png ?? raw.base64 ?? raw.imageBase64 ?? raw.pngBase64 ?? raw.data ?? "";
    const width = raw.width ?? raw.w ?? 1280;
    const height = raw.height ?? raw.h ?? 800;
    const dpr = raw.deviceScaleFactor ?? raw.dpr ?? 1;
    if (!base64 || typeof base64 !== "string") return undefined;
    return { base64Png: base64, width, height, deviceScaleFactor: dpr };
}
