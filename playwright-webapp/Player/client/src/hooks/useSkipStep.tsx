import { runPixel } from "@semoss/sdk";

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
}: UseSkipStepProps) {
async function handleSkipStep() {
    try {
    setLoading(true);
    setError?.(null);

    const pixel = `SkipStep (sessionId = "${sessionId}", fileName = "${selectedRecording}");`;
    const res = await runPixel(pixel, insightId);
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
