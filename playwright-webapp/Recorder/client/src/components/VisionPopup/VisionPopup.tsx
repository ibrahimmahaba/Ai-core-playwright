import { TextField } from "@mui/material";
import Draggable from "react-draggable";
import StyledPrimaryButton from "../StyledButtons/StyledPrimaryButton";
import StyledButton from "../StyledButtons/StyledButtonRoot";
import StyledDangerButton from "../StyledButtons/StyledDangerButton";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../../utils/errorHandler";
import { useSessionStore } from "../../store/useSessionStore";
import './vision-popup.css';
import type { Coords, VisionPopupProps } from "../../types";
import { useSendStep } from "../../hooks/useSendStep";


export function VisionPopup(props: VisionPopupProps) {
  const { visionPopup, setVisionPopup, currentCropArea, setCurrentCropArea, setCrop, imgRef } = props;

  const { sessionId, insightId, selectedModel, activeTabId, setMode } = useSessionStore();
  const { sendStep } = useSendStep();

  async function handleLLMAnalysis() {
    if (!visionPopup || !visionPopup.query.trim() || !currentCropArea) return;
    
    try {
      const imgRect = imgRef?.current?.getBoundingClientRect();
      
      const displayWidth = imgRect?.width ??  1280;
      const displayHeight = imgRect?.height ?? 800; 

      const screenshotWidth = 1280;
      const screenshotHeight = 800;
      
      // Scale coordinates
      const scaledCropArea = {
        startX: Math.round((currentCropArea.startX / displayWidth) * screenshotWidth),
        startY: Math.round((currentCropArea.startY / displayHeight) * screenshotHeight),
        endX: Math.round((currentCropArea.endX / displayWidth) * screenshotWidth),
        endY: Math.round((currentCropArea.endY / displayHeight) * screenshotHeight)
      };

      const pixel = `ImageContext(
        sessionId="${sessionId}",
        tabId="${activeTabId}",
        engine="${selectedModel?.value}", 
        paramValues=[{
          "startX": ${scaledCropArea.startX}, 
          "startY": ${scaledCropArea.startY}, 
          "endX": ${scaledCropArea.endX}, 
          "endY": ${scaledCropArea.endY},
          "userPrompt": "${visionPopup.query}"
        }]
      )`;
      
      const res = await runPixel(pixel, insightId);
      
      if (checkSessionExpired(res.pixelReturn)) {
        return;
      }
      
      const output = res.pixelReturn[0].output as { response: string };
      console.log("LLM Vision output:", output);
      
      setVisionPopup({ ...visionPopup, response: output.response });

    } catch (err) {
      console.error("LLM Vision error:", err);
    }
  }

  async function handleStoreStep() {
    if (!visionPopup || !currentCropArea) return;
    
    try {
      const imgRect = imgRef?.current?.getBoundingClientRect();
      
      const displayWidth = imgRect?.width ??  1280;
      const displayHeight = imgRect?.height ?? 800; 

      const screenshotWidth = 1280;
      const screenshotHeight = 800;
      
      // Scale coordinates
      const scaledCropArea = {
        startX: Math.round((currentCropArea.startX / displayWidth) * screenshotWidth),
        startY: Math.round((currentCropArea.startY / displayHeight) * screenshotHeight),
        endX: Math.round((currentCropArea.endX / displayWidth) * screenshotWidth),
        endY: Math.round((currentCropArea.endY / displayHeight) * screenshotHeight)
      };

      await sendStep({
        type: "CONTEXT",
        multiCoords: [
          { x: scaledCropArea.startX, y: scaledCropArea.startY },
          { x: scaledCropArea.endX, y: scaledCropArea.endY }
        ]as Coords[],
        prompt: visionPopup.query,
        viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
        timestamp: Date.now()
      });

      alert("Saved");
      
      setVisionPopup(null);
      setCurrentCropArea(null);
      setMode("click");
      setCrop(undefined);
      
    } catch (err) {
      console.error("Error storing context step:", err);
    }
  }

  return (
    <div>
        {visionPopup && (
            <Draggable handle="strong">
              <div className="vision-popup-container" 
              style={{ top: visionPopup.y,
                left: visionPopup.x,
                transform: "translate(-50%, -100%)",
                }}>
                {!visionPopup.response ? (
                  <>
                    <strong style={{ cursor: "move", display: "block", marginBottom: "8px", color: "black", borderBottom: "1px solid #e0e0e0" }}>Add Context</strong>
                    <TextField
                      label="Ask about this area"
                      size="small"
                      fullWidth
                      value={visionPopup.query}
                      onChange={(e) =>
                        setVisionPopup({ ...visionPopup, query: e.target.value })
                      }
                    />
                    <StyledPrimaryButton
                      onClick={handleLLMAnalysis}
                      fullWidth
                    >
                      Submit
                    </StyledPrimaryButton>
                     <StyledButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Close
                      </StyledButton>
                  </>
                ) : (
                  <>
                    <strong style={{ cursor: "move", display: "block", marginBottom: "8px", color: "black", borderBottom: "1px solid #e0e0e0" }}>Add Context</strong>
                    <TextField
                      fullWidth
                      multiline
                      rows={6}
                      value={visionPopup.response}
                      onChange={(e) => setVisionPopup({ ...visionPopup, response: e.target.value })}
                      variant="outlined"
                      placeholder="Edit the response..."
                    />
                    <div className="vision-popup-button-group">
                      <StyledButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Close
                      </StyledButton>
                      <StyledPrimaryButton onClick={handleStoreStep}>
                        Store Step
                      </StyledPrimaryButton>
                      <StyledDangerButton onClick={async () => {
                        setVisionPopup({ ...visionPopup, response: null });
                      }}>
                        Retry
                      </StyledDangerButton>
                    </div>
                  </>
                )}
              </div>
            </Draggable>
          )}
    </div>
  )
}

export default VisionPopup