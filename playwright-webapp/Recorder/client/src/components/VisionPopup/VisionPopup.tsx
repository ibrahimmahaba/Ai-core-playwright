import { TextField } from "@mui/material";
import Draggable from "react-draggable";
import StyledPrimaryButton from "../StyledButtons/StyledPrimaryButton";
import StyledButton from "../StyledButtons/StyledButtonRoot";
import StyledDangerButton from "../StyledButtons/StyledDangerButton";
import { runPixel } from "@semoss/sdk";
import { useSessionStore } from "../../store/useSessionStore";
import './vision-popup.css';
import type { Coords, VisionPopupProps } from "../../types";
import { useSendStep } from "../../hooks/useSendStep";


export function VisionPopup(props: VisionPopupProps) {
  const { visionPopup, setVisionPopup, currentCropArea, setCurrentCropArea, setCrop } = props;

  const { sessionId, insightId, selectedModel, activeTabId, setMode } = useSessionStore();
  const { sendStep } = useSendStep();

  async function handleLLMAnalysis() {
    if (!visionPopup || !visionPopup.query.trim() || !currentCropArea) return;
    
    try {
      const pixel = `ImageContext(
        sessionId="${sessionId}",
        tabId="${activeTabId}",
        engine="${selectedModel?.value}", 
        paramValues=[{
          "startX": ${currentCropArea.startX}, 
          "startY": ${currentCropArea.startY}, 
          "endX": ${currentCropArea.endX}, 
          "endY": ${currentCropArea.endY},
          "userPrompt": "${visionPopup.query}"
        }]
      )`;
      
      const res = await runPixel(pixel, insightId);
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
      await sendStep({
        type: "CONTEXT",
        multiCoords: [
          { x: currentCropArea.startX, y: currentCropArea.startY },
          { x: currentCropArea.endX, y: currentCropArea.endY }
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
            <Draggable>
              <div className="vision-popup-container" 
              style={{ top: visionPopup.y,
                left: visionPopup.x,
                transform: "translate(-50%, -100%)",
                }}>
                {!visionPopup.response ? (
                  <>
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