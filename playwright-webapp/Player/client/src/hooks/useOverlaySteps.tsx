import { IconButton } from "@mui/material";
import { Check, Close } from "@mui/icons-material";
import { useEffect, useState } from "react";
import type { Action, Coords, ScreenshotResponse } from "../types";

interface UseOverlayStepsProps {
  shot: ScreenshotResponse | undefined;
  editedData: Action[];
  imgRef: any;
  showFutureSteps: boolean;
  loading: boolean;
  handleNextStep: () => void;
  handleSkipStep: () => void;
}

function extractActionData(action: any, shot: ScreenshotResponse): { type: string; coords: Coords | null; text: string } {
  const allKeys = Object.keys(action);

  const actionTypes = ['CLICK', 'TYPE', 'SCROLL', 'WAIT', 'NAVIGATE'];
  const type = allKeys.find(key => actionTypes.includes(key)) || allKeys[0];


  
  let coords: Coords | null = null;
  let text = "";

  if (type === "CLICK" && "CLICK" in action) {
    const clickData = action.CLICK as any;

    
    // Backend sends CLICK as { x: number, y: number } directly, NOT { coords: {...} }
    if (clickData && typeof clickData === 'object') {
      if (clickData.x !== undefined && clickData.y !== undefined) {
        coords = { x: clickData.x, y: clickData.y };
      } else if (clickData.coords) {
        coords = clickData.coords;
      }
    }

    if (!coords) {
      console.warn(`  ⚠️ CLICK data exists but coords not found. clickData structure:`, JSON.stringify(clickData));
    }
  } else if (type === "TYPE" && "TYPE" in action) {
    const typeData = action.TYPE as any;

    
    text = typeData.text || "";
    if (typeData && typeData.coords) {
      coords = typeData.coords;
    } else {
      console.warn(`  ⚠️ TYPE data exists but coords not found. typeData structure:`, JSON.stringify(typeData));
    }
  } else if (type === "SCROLL") {
    // SCROLL always goes to center by default
    coords = { x: shot.width / 2, y: shot.height / 2 };
  } else {
    console.warn(`  ⚠️ Unknown or unsupported action type: ${type}`);
  }

  return { type, coords, text };
}

export function useOverlaySteps({
  shot,
  editedData,
  imgRef,
  showFutureSteps,
  loading,
  handleNextStep,
  handleSkipStep,
}: UseOverlayStepsProps) {
  const [forceRender, setForceRender] = useState(0);

  // TO BE UPDATED:  this will later be changed to loaded data from backend instead of editedData
  useEffect(() => {
    if (shot && editedData && editedData.length > 0 && imgRef?.current) {
      console.log("force re-render", forceRender);
      setForceRender(prev => prev + 1);
    }
  }, [shot, editedData, editedData.length, imgRef]);

  const renderStepLabels = () => {
    if (!shot || !editedData || editedData.length === 0 || !imgRef.current) {
      return null;
    }

   
    
    return (
      <>
        {editedData.map((action, index) => {


          // Extract action data
          const { type, coords: extractedCoords, text } = extractActionData(action as any, shot);

          let coords = extractedCoords;

          // Default to center if no coordinates found for CLICK or TYPE
          if (!coords && (type === "CLICK" || type === "TYPE")) {
            console.warn(`⚠️ Step ${index} (${type}) has no coords, using center as default`);
            // Offset each default by 50px to avoid overlapping
            coords = {
              x: shot.width / 2 + (index * 50),
              y: shot.height / 2 + (index * 50)
            };
          }

          if (!coords) {

            return null;
          }

          // If this is not the first step and showNonCurrentStepIndicators is false, don't render
          if (index > 0 && !showFutureSteps) {
            return null;
          }

        
          // Calculate position on scaled image
          const imgElement = imgRef.current!;
          const imgRect = imgElement.getBoundingClientRect();
          const scaleX = imgRect.width / shot.width;
          const scaleY = imgRect.height / shot.height;

          const stepNumber = index + 1;
          const isNextStep = index === 0;

          const labelLeft = coords.x * scaleX;
          const labelTop = coords.y * scaleY;


          
          // For TYPE steps at index 0, don't show the indicator at all
          if (type === "TYPE" && index === 0) {
            return null;
          }

          return (
            <div
              key={`step-label-${index}`}
              className="step-label"
              data-step-type={type}
              style={{
                position: "absolute",
                left: labelLeft,
                top: labelTop,
                transform: "translate(-50%, -50%)",
                zIndex: 9999,
              }}
            >
              {/* For CLICK at index 0, show red pulsing circle like highlight-indicator */}
              {type === "CLICK" && index === 0 ? (
                <div
                  className="step-circle-click-current"
                  style={{
                    width: "30px",
                    height: "30px",
                    border: "3px solid red",
                    borderRadius: "50%",
                    pointerEvents: "none",
                    boxSizing: "border-box",
                    animation: "pulse 1s infinite",
                  }}
                />
              ) : (
                <>
                  <div
                    className="step-circle"
                    style={{
                      background: isNextStep ? "#4CAF50" : "#1976D2",
                      color: "white",
                      minWidth: "20px",
                      height: "20px",
                      padding: "0 2px",
                      borderRadius: "35%",
                      fontSize: "15px",
                      fontWeight: "bold",
                      border: "3px solid white",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "default",
                    }}
                  >
                    {index > 0 && stepNumber}
                  </div>
                  <div className="step-tooltip">{type} | {text == "" ? "" : text}</div>
                </>
              )}

              {/* Execute and Skip buttons for CLICK steps when it's the first step */}
              {type === "CLICK" && index === 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginTop: "4px",
                  display: "flex",
                  gap: "8px",
                  pointerEvents: "auto",
                }}>
                  <IconButton
                    size="small"
                    onClick={handleNextStep}
                    disabled={loading}
                    color="success"
                    sx={{ backgroundColor: 'rgba(25, 118, 210, 0.1)' }}
                  >
                    <Check fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={()=> {
                      handleSkipStep();
                    }}
                    disabled={loading}
                    color="error"
                    sx={{ backgroundColor: 'rgba(25, 118, 210, 0.1)' }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  return { renderStepLabels };
}

