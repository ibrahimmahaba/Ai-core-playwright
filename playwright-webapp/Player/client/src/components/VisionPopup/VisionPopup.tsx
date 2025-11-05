
import { CircularProgress, TextField } from "@mui/material";
import Draggable from "react-draggable";
import StyledPrimaryButton from "../StyledButtons/StyledPrimaryButton";
import StyledButton from "../StyledButtons/StyledButtonRoot";
import StyledDangerButton from "../StyledButtons/StyledDangerButton";
import type { VisionPopupProps } from "../../types";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../../utils/errorHandler";
import './VisionPopup.css';
import { useState } from "react";

export function VisionPopup(props : VisionPopupProps) {
    const {sessionId, insightId, insight, visionPopup , setVisionPopup,
    currentCropArea, setCurrentCropArea,  setMode, setCrop, selectedModel, tabId} = props
    const [isLoading, setIsLoading] = useState(false);
    const [isAddingToContext, setIsAddingToContext] = useState(false);
  
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

  function removeSpecialCharacters(input: string): string {
    return input.replace(/["'\\]/g, "");
  }


  async function handleAddToContext() {
    if (!visionPopup || !visionPopup.response) return;

    setIsAddingToContext(true);

    try {

      const sanitizedVisionAPIResponse = removeSpecialCharacters(visionPopup.response);

      const { output } = await insight.actions.runMCPTool("AddVisionContext", {
        visionContext: sanitizedVisionAPIResponse,
        sessionId: sessionId
      });

      console.log('Vision context added successfully:', output);

      setVisionPopup(null);
      setCurrentCropArea(null);
      setMode("click");
      setCrop(undefined);

    } catch (error) {
      console.error("Error adding vision context:", error);
      console.log("Failed to add to context. Error: ", error)
    } finally {
      setIsAddingToContext(false);
    }
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
                {!visionPopup.response && (
                  <>
                    <TextField
                      label="Ask about this area"
                      size="small"
                      fullWidth
                      value={visionPopup.query}
                      disabled={isLoading}
                      onChange={(e) =>
                        setVisionPopup({ ...visionPopup, query: e.target.value })
                      }
                    />
                    <StyledPrimaryButton
                      onClick={handleLLMAnalysis}
                      fullWidth
                      disabled={isLoading}
                    >
                      {isLoading ? "Processing..." : "Submit"}
                    </StyledPrimaryButton>
                    {isLoading && <CircularProgress size={24} />}
                  </>
                )}
                {visionPopup.response && (
                  <>
                    <div className="vision-popup-response">
                      {visionPopup.response}
                    </div>
                    <div className="vision-popup-buttons">
                      <StyledButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Close
                      </StyledButton>
                      {/* <StyledPrimaryButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Add to Context
                      </StyledPrimaryButton> */}
                      <StyledPrimaryButton onClick={handleAddToContext} disabled={isAddingToContext}>
                          {isAddingToContext && <CircularProgress size={24} />}
                          {isAddingToContext ? "Adding..." : "Add to Context"}
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