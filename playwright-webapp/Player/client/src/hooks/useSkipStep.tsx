import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../utils/errorHandler";

interface ReplayPixelOutput {
actions: any;
isLastPage: boolean;
}

interface UseSkipStepProps {
sessionId: string;
selectedRecording: string | null;
insightId: string;

setEditedData: (data: any) => void;
setIsLastPage: (val: boolean) => void;
setOverlay: (val: any) => void;
setLoading: (val: boolean) => void;
setError?: (val: string | null) => void;
activeTabId: string;
}

export function useSkipStep({
sessionId,
selectedRecording,
insightId,
setEditedData,
setIsLastPage,
setOverlay,
setLoading,
setError,
activeTabId,
}: UseSkipStepProps) {
async function handleSkipStep() {
    try {
    setLoading(true);
    setError?.(null);
    const currentTabId = activeTabId || "tab-1";  

    let pixel = `SkipStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId = "${currentTabId}");`;
    const res = await runPixel(pixel, insightId);
    
    if (checkSessionExpired(res.pixelReturn)) {
      return;
    }
    
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

    setEditedData(output.actions);
    setIsLastPage(output.isLastPage);
    setOverlay(null);
    } catch (err: any) {
    console.error("Failed to skip step:", err);
    setError?.(err.message || "Something went wrong");
    } finally {
    setLoading(false);
    }
}

return { handleSkipStep };
}
