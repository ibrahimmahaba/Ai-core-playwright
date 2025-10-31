import { TextField } from "@mui/material";
import Draggable from "react-draggable";
import StyledPrimaryButton from "../StyledButtons/StyledPrimaryButton";
import StyledButton from "../StyledButtons/StyledButtonRoot";
import StyledDangerButton from "../StyledButtons/StyledDangerButton";
import { runPixel } from "@semoss/sdk";
import { useSessionStore } from "../../store/useSessionStore";
import './vision-popup.css';
import type { VisionPopupProps } from "../../types";

export function VisionPopup(props: VisionPopupProps) {
  const { visionPopup, setVisionPopup, currentCropArea, setCurrentCropArea, setCrop } = props;

  const { sessionId, insightId, selectedModel, activeTabId, setMode } = useSessionStore();

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
                  </>
                ) : (
                  <>
                    <div className="vision-popup-response">
                      {visionPopup.response}
                    </div>
                    <div className="vision-popup-button-group">
                      <StyledButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Close
                      </StyledButton>
                      <StyledPrimaryButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Add to Context
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