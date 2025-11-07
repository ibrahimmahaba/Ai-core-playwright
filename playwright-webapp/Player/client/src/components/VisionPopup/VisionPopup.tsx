import { TextField } from "@mui/material";
import Draggable from "react-draggable";
import StyledPrimaryButton from "../StyledButtons/StyledPrimaryButton";
import StyledButton from "../StyledButtons/StyledButtonRoot";
import StyledDangerButton from "../StyledButtons/StyledDangerButton";
import type { VisionPopupProps } from "../../types";
import { runPixel } from "@semoss/sdk";
import './VisionPopup.css';
import { useState } from "react";

export function VisionPopup(props : VisionPopupProps) {
    const {sessionId, insightId, visionPopup , setVisionPopup,
    currentCropArea, setCurrentCropArea,  setMode, setCrop, selectedModel, tabId, storedContexts, setStoredContexts} = props;
    const [isLoading, setIsLoading] = useState(false);

    async function handleLLMAnalysis() {

    if (!visionPopup || !visionPopup.query.trim() || !currentCropArea) return;    

    setIsLoading(true);

    try {
      const pixel = `ImageContext(
        sessionId="${sessionId}",
        tabId="${tabId}",
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
    finally{
      if(isLoading){          
        setIsLoading(false);
      }
    }
  }

  function handleAddToContextList() {
    if (!visionPopup?.response) return;
    
    setStoredContexts([...storedContexts, visionPopup.response]);
    setVisionPopup({ ...visionPopup, response: null });
  }

  
  return (
    <div>
        {visionPopup && (
            <Draggable>
              <div className="vision-popup-dialog" style={{
                top: visionPopup.y,
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
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
                    </div>
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
                    <div className="vision-popup-buttons">
                      <StyledButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Close
                      </StyledButton>
                      <StyledPrimaryButton onClick={handleAddToContextList}>
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