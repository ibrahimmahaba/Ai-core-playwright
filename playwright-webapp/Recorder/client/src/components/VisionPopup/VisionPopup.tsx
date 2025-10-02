import { TextField } from "@mui/material";
import Draggable from "react-draggable";
import StyledPrimaryButton from "../StyledButtons/StyledPrimaryButton";
import StyledButton from "../StyledButtons/StyledButtonRoot";
import StyledDangerButton from "../StyledButtons/StyledDangerButton";
import type { ScreenshotResponse, VisionPopupProps } from "../../types";
import { runPixel } from "@semoss/sdk";
import '../../css/vision-popup.css';


export function VisionPopup(props : VisionPopupProps) {
    const {sessionId, insightId, visionPopup , setVisionPopup, currentCropArea, setCurrentCropArea,  setMode, setCrop} = props
  
  // async function handleLLMAnalysis(engineId: string | null) {
  //   if (!visionPopup || !visionPopup.query.trim() || !currentCropArea) return;
  //   
    
  //   try {
  //     const pixel = `ImageContext(
  //       sessionId="${sessionId}",
  //       engine="${engineId ? engineId : '029a1323-db79-415c-be3e-3945438b0808'}", 
  //       paramValues=[{
  //         "startX": ${cropArea.startX}, 
  //         "startY": ${cropArea.startY}, 
  //         "endX": ${cropArea.endX}, 
  //         "endY": ${cropArea.endY},
  //         "userPrompt": "${userPrompt}"
  //       }]
  //     )`;
      
  //     const res = await runPixel(pixel, insightId);
  //     const output = res.pixelReturn[0].output as { response: string };
      
  //    
        //setVisionPopup({ ...visionPopup, response: resp });

      
  //   } catch (err) {
  //     console.error("LLM Vision error:", err);
  //   }
  // }
  
  // done
  async function handleLLMAnalysis() {
    if (!visionPopup || !visionPopup.query.trim() || !currentCropArea) return;
  
    try {
      const cropPixel = `Screenshot(
        sessionId="${sessionId}", 
        paramValues=[{
          "startX": ${currentCropArea.startX}, 
          "startY": ${currentCropArea.startY}, 
          "endX": ${currentCropArea.endX}, 
          "endY": ${currentCropArea.endY}
        }]
      )`;
  
      const cropRes = await runPixel(cropPixel, insightId);
      const croppedImage = cropRes.pixelReturn[0].output as ScreenshotResponse;
      console.log("Cropped image obtained for vision analysis.");
      console.log(croppedImage);
      const resp = await callVisionAPI(visionPopup.query, croppedImage.base64Png);
  
      setVisionPopup({ ...visionPopup, response: resp });
    } catch (err) {
      console.error("Vision analysis error:", err);
      alert("Error: " + err);
    }
  }

  async function callVisionAPI(query: string, base64Image: string): Promise<string> {
    const AUTH_TOKEN = import.meta.env.VITE_AUTH_KEY;
    const ENGINE_ID = "4acbe913-df40-4ac0-b28a-daa5ad91b172";
    
    const expression = `Vision(engine="${ENGINE_ID}", command = "${query}", image="data:image/png;base64,${base64Image}")`;
    
    const encodedExpression = encodeURIComponent(expression);
    
    const requestBody = `expression=${encodedExpression}`;
    
    const response = await fetch("https://workshop.cfg.deloitte.com/Monolith/api/engine/runPixel", {
      method: "POST",
      headers: {
        "authorization": `Basic ${AUTH_TOKEN}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: requestBody
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    return result.pixelReturn[0].output.response || "No response received";
  }

  
  return (
    <div>
        {visionPopup && (
            <Draggable>
              <div className="vision-popup-container">
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