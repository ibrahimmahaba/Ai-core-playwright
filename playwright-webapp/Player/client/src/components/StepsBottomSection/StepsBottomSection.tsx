import type { Action, ReplayPixelOutput, StepsBottomSectionProps, Viewport } from "../../types";
import { runPixel } from "@semoss/sdk";
import './StepsBottomSection.css';
import { useSendStep } from "../../hooks/useSendStep";
import { preferSelectorFromProbe } from "../../hooks/usePreferSelector";
import { useProbeAt } from "../../hooks/useProbeAt";
import { useSkipStep } from "../../hooks/useSkipStep";
import { IconButton } from "@mui/material";
import { SkipPrevious as SkipPreviousIcon, Pause as PauseIcon, SkipNext as SkipNextIcon } from "@mui/icons-material";
import { useState } from "react";


function StepsBottomSection(props : StepsBottomSectionProps) {
    const {
        showData, setShowData, setIsLastPage, editedData,
        overlay, setOverlay, sessionId, selectedRecording, 
        setLoading, insightId, setEditedData, updatedData, setUpdatedData, setShot,
        setHighlight, steps, setSteps, shot, activeTabId, tabs, setTabs , setActiveTabId,
        setCurrentCropArea, setVisionPopup, setMode, setCrop, imgRef
    } = props

    const { sendStep } = useSendStep({
        insightId : insightId,
        sessionId : sessionId,
        shot: shot,
        setShot: setShot,
        steps: steps,
        setSteps: setSteps,
        setLoading: setLoading
    });

    const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
    };

    const showHighlight = (x: number, y: number) => {
        setHighlight({ x, y });
        setTimeout(() => setHighlight(null), 4000); 
      }
      async function handleNextStep() {
        const nextAction = editedData[0];
        console.log("Handling next action:", nextAction);
        console.log("Selected recording:", selectedRecording);
        
        const actionTabId = (nextAction as any).tabId || activeTabId || "tab-1";
        if ("CONTEXT" in nextAction) {
          const coords = nextAction.CONTEXT.multiCoords;
          console.log("CONTEXT action detected - showing crop overlay");
          if (coords && coords.length >= 2) {

            const imgRect = imgRef?.current?.getBoundingClientRect();

            console.log("imgRect:",imgRect);
      
            const displayWidth = imgRect?.width ??  1280;
            const displayHeight = imgRect?.height ?? 800; 

            console.log("displayWidth", displayWidth);
            console.log("displayHeight", displayHeight);

            const screenshotWidth = 1280;
            const screenshotHeight = 800;
            
            // Scale coordinates
            const scaleX = displayWidth / screenshotWidth;   
            const scaleY = displayHeight / screenshotHeight;
            
            const scaled = coords.map((c: any) => ({
              x: Math.round(c.x * scaleX),  // 249 * 0.53 = 132
              y: Math.round(c.y * scaleY)   // 123 * 0.53 = 65
            }));

            console.log('Screenshot size:', screenshotWidth, 'x', screenshotHeight);
            console.log('Display size:', displayWidth, 'x', displayHeight);
            console.log('Original coords (screenshot space):', coords);

            setCurrentCropArea({
              startX: scaled[0].x,
              startY: scaled[0].y,
              endX: scaled[1].x,
              endY: scaled[1].y
            });
            
            setVisionPopup({
              x: scaled[1].x,
              y: scaled[0].y,
              query: nextAction.CONTEXT.prompt,
              response: null
            });
            setMode("crop");
            
            setCrop({
                  unit: 'px',
                  x: scaled[0].x,
                  y: scaled[0].y,
                  width: scaled[1].x - scaled[0].x,
                  height: scaled[1].y - scaled[0].y
            });
          }
        }

        if (!selectedRecording) {
          console.log("Executing step directly via sendStep");
          setLoading(true);
          
          try {
            // Convert Action to Step and execute
            if ("CLICK" in nextAction) {
              const p = await useProbeAt(nextAction.CLICK.coords, sessionId, insightId, activeTabId);
              await sendStep({
                type: "CLICK",
                coords: nextAction.CLICK.coords,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 1000,
                selector: preferSelectorFromProbe(p)  || { strategy: "css", value: "body" }
              }, activeTabId);
            } else if ("TYPE" in nextAction) {
              const text = overlay?.draftValue ?? nextAction.TYPE.text;
              await sendStep({
                type: "TYPE",
                coords: nextAction.TYPE.coords || { x: 0, y: 0 },
                text: text,
                label: nextAction.TYPE.label,
                isPassword: nextAction.TYPE.isPassword || false,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 1000,
                storeValue: false,
                selector: preferSelectorFromProbe(nextAction.TYPE.probe) ?? { strategy: "css", value: "body"}
              }, activeTabId);
            } else if ("SCROLL" in nextAction) {
              await sendStep({
                type: "SCROLL",
                coords: { x: 0, y: 0 },
                deltaY: nextAction.SCROLL.deltaY,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 500
              }, activeTabId || "tab-1");
            } else if ("WAIT" in nextAction) {
              await new Promise(resolve => setTimeout(resolve, nextAction.WAIT));
            } else if ("NAVIGATE" in nextAction) {
              await sendStep({
                type: "NAVIGATE",
                url: nextAction.NAVIGATE,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 2000
              }, activeTabId);
            }
            
            // Remove executed step from current tab
            if (tabs && setTabs && activeTabId) {
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const newActions = tab.actions.slice(1);
                  return { ...tab, actions: newActions };
                }
                return tab;
              }));
            }
            
            const newEditedData = editedData.slice(1);
            setEditedData(newEditedData);
            setUpdatedData(newEditedData);
            setOverlay(null);
          } finally {
            setLoading(false);
          }
          return;
        }
        
        console.log("Executing step via ReplayStep pixel");
        let pixel;
        
        if ("TYPE" in nextAction) {
          if (overlay && overlay.draftValue !== undefined) {
            nextAction.TYPE.text = overlay.draftValue;
          }
          const { label, text } = nextAction.TYPE;
          let paramValues = { [label]: text };
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${actionTabId}", paramValues=[${JSON.stringify(paramValues)}], executeAll=false);`;
          setOverlay(null);
        } else {
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${actionTabId}", executeAll=false);`;
        }
        
        setLoading(true);
        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };
    
        console.log("StepsBottomSection - ReplayStep output:", output);
    
        // Check if this action opened a new tab
        const isNewTab = output.isNewTab;
        const newTabId = output.newTabId;
        const tabTitle = output.tabTitle;
        const originalTabId = output.originalTabId || actionTabId;
        const originalTabActions = output.originalTabActions || [];
        
        if (isNewTab && newTabId && tabs && setTabs && setActiveTabId) {
          console.log("StepsBottomSection, New tab detected:", newTabId, tabTitle);
          console.log("Original tab:", originalTabId, "has", originalTabActions.length, "remaining actions");
          
          // Check if tab already exists
          const tabExists = tabs.find(t => t.id === newTabId);
          
          setTabs(prevTabs => {
            // Update both the original tab and the new tab
            let updatedTabs = prevTabs.map(tab => {
              if (tab.id === newTabId) {
                // Update existing new tab
                return {
                  id: newTabId,
                  title: tabTitle || newTabId,
                  actions: output.actions || []
                };
              } else if (tab.id === originalTabId) {
                return {
                  ...tab,
                  actions: originalTabActions
                };
              }
              return tab;
            });
            
            // Add new tab if it doesn't exist
            if (!tabExists) {
              updatedTabs.push({
                id: newTabId,
                title: tabTitle || newTabId,
                actions: output.actions || []
              });
            }
            
            console.log("StepsBottomSection, Updated tabs array:", updatedTabs);
            return updatedTabs;
          });
          
          // Switch to the new tab
          setActiveTabId(newTabId);
          console.log("StepsBottomSection, Switched to tab:", newTabId);
          
          // Update displayed actions for the new tab
          setEditedData(output.actions || []);
          setUpdatedData(output.actions || []);
        } else {
          const newEditedData = editedData.slice(1);
          console.log("newEditedData after executing step:", newEditedData);
          if (!newEditedData || newEditedData.length === 0) {
            console.log("No more edited data, setting to output actions");
            setEditedData(output.actions);
            setUpdatedData(output.actions);
          } else {
            console.log("Merging output actions into remaining edited data");
            const updatedEditedData = newEditedData.map((action, index) => {
              if (output.actions[index]) {
                return { ...action, ...output.actions[index] };
              }
              return action;
            });
            setEditedData(updatedEditedData);
          }
          
          setUpdatedData(output.actions);
          
          if (tabs && setTabs && activeTabId) {
            console.log("Updating tabs actions for tab:", actionTabId);
            console.log("New actions for tab:", output.actions || []);
            setTabs(prevTabs => prevTabs.map(tab => {
              if (tab.id === actionTabId) {
                return { ...tab, actions: output.actions || tab.actions.slice(1) };
              }
              return tab;
            }));
          }
        }
        setLoading(false);
        setShowData(true);
        setIsLastPage(output.isLastPage);
        setShot(output.screenshot);
        setOverlay(null);
      }
    
      async function handleExecuteAll() {
        setLoading(true);
        const currentTabId = activeTabId || "tab-1";  

        // If no recording file
        if (!selectedRecording) {
          try {
            for (const action of editedData) {
            if ("CLICK" in action) {
                const p = await useProbeAt(action.CLICK.coords, sessionId, insightId, activeTabId);
                await sendStep({
                    type: "CLICK",
                    coords: action.CLICK.coords,
                    viewport,
                    timestamp: Date.now(),
                    waitAfterMs: 1000,
                    selector: preferSelectorFromProbe(p)  || { strategy: "css", value: "body" }
                }, activeTabId);
                } else if ("TYPE" in action) {
                const text = overlay?.draftValue ?? action.TYPE.text;
                await sendStep({
                    type: "TYPE",
                    coords: action.TYPE.coords || { x: 0, y: 0 },
                    text: text,
                    label: action.TYPE.label,
                    isPassword: action.TYPE.isPassword || false,
                    viewport,
                    timestamp: Date.now(),
                    waitAfterMs: 1000,
                    storeValue: false,
                    selector: preferSelectorFromProbe(action.TYPE.probe) ?? { strategy: "css", value: "body"}
                }, activeTabId);
              } else if ("SCROLL" in action) {
                await sendStep({
                  type: "SCROLL",
                  coords: { x: 0, y: 0 },
                  deltaY: action.SCROLL.deltaY,
                  viewport,
                  timestamp: Date.now(),
                  waitAfterMs: 500
                }, activeTabId);
              } else if ("WAIT" in action) {
                await new Promise(resolve => setTimeout(resolve, action.WAIT));
              } else if ("NAVIGATE" in action) {
                await sendStep({
                  type: "NAVIGATE",
                  url: action.NAVIGATE,
                  viewport,
                  timestamp: Date.now(),
                  waitAfterMs: 2000
                }, activeTabId);
              }
              
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            if (tabs && setTabs && activeTabId) {
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  return { ...tab, actions: [] };
                }
                return tab;
              }));
            }

            setEditedData([]);
            setUpdatedData([]);
            setShowData(false);
            alert("All steps executed successfully!");
          } catch (err) {
            console.error("Error executing steps:", err);
            alert("Error executing steps: " + err);
          } finally {
            setLoading(false);
          }
          return;
        }
        
        updatedData.reduce<Record<string, string>[]>((acc, action) => {
          if ("TYPE" in action) {
            acc.push({ [action.TYPE.label]: action.TYPE.text });
          }
          return acc;
        }, []);
      
        let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${currentTabId}", executeAll=true);`;
        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

        if (tabs && setTabs && activeTabId) {
          setTabs(prevTabs => prevTabs.map(tab => {
            if (tab.id === activeTabId) {
              return { ...tab, actions: [] };
            }
            return tab;
          }));
        }
        console.log("Execute All output:", output);
        setLoading(false);
        setEditedData(output.actions);
        setUpdatedData(output.actions);
        setShowData(true);
        setIsLastPage(output.isLastPage);
        setShot(output.screenshot);
      }

    const { handleSkipStep } = useSkipStep({
      sessionId,
      selectedRecording,
      insightId,
      setEditedData,
      setIsLastPage,
      setOverlay,
      setLoading,
      activeTabId: activeTabId || "",
    });

    function handleSkipAll() {
        setEditedData([]);
        setUpdatedData([]);
        setShowData(false);
        setOverlay(null);
    }

    const [isPaused, setIsPaused] = useState(false);
    const totalSteps = editedData?.length || 0;
    const currentStep = totalSteps > 0 ? totalSteps - (editedData?.length || 0) + 1 : 0;
    const progressPercentage = totalSteps > 0 ? ((currentStep / totalSteps) * 100) : 0;

    function handlePreviousStep() {
        // Go to previous step - this would need to be implemented based on your step history
        console.log("Previous step");
    }

    function handlePause() {
        setIsPaused(!isPaused);
        // Implement pause logic if needed
    }

    function handleNextStepControl() {
        handleNextStep();
    }

    return (
        <>
            {/* Control bar with playback controls and progress bar */}
            <div className="remote-runner-control-bar">
                <IconButton onClick={handlePreviousStep} disabled={currentStep <= 1} title="Previous Step">
                    <SkipPreviousIcon />
                </IconButton>
                <IconButton onClick={handlePause} title={isPaused ? "Resume" : "Pause"}>
                    <PauseIcon />
                </IconButton>
                <IconButton onClick={handleNextStepControl} disabled={!editedData || editedData.length === 0} title="Next Step">
                    <SkipNextIcon />
                </IconButton>
            </div>
            <div className="remote-runner-progress-bar">
                <div className="remote-runner-progress-bar-track">
                    <div 
                        className="remote-runner-progress-bar-fill" 
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <div className="remote-runner-progress-text">
                    Step {currentStep} of {totalSteps}
                </div>
            </div>

            {showData && (
                <div className="steps-container">
                    <div className="steps-header">
                        <h4>Edit Replay Variables</h4>
                    </div>

                    {!editedData || editedData.length === 0 ? (
                        <div>No variables found.</div>
                    ) : (
                        <table className="steps-table">
                            <thead>
                                <tr>
                                    <th>Label</th>
                                    <th>Value</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editedData.map((action, index) => {
                                    const type = Object.keys(action).find(key => key !== 'tabId') as keyof Action;
                                    const details = action[type] as any;
                                    const detailCoords = details?.coords
                                        ? [{ x: details.coords.x, y: details.coords.y }]
                                        : 
                                        details?.multiCoords
                                        ? [{x:details.multiCoords[0].x, y:details.multiCoords[0].y}, {x:details.multiCoords[1].x, y:details.multiCoords[1].y}]
                                        : details?.x
                                            ? [{ x: details.x, y: details.y }]
                                            : [{ x: 0, y: 0 }];

                                    switch (type) {
                                        case "TYPE":
                                            return (
                                                <tr key={index}>
                                                    <td>{details.label}</td>
                                                    <td>{details.text || ""}</td>
                                                    {index === 0 && (
                                                        <td>
                                                            <button onClick={handleNextStep}>Execute →</button>
                                                            <button onClick={handleSkipStep}>Skip</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );

                                        case "CLICK":
                                            return (
                                                <tr key={index}>
                                                    <td>Click</td>
                                                    <td>
                                                        ({detailCoords[0].x}, {detailCoords[0].y})
                                                        <button onClick={() => showHighlight(detailCoords[0].x, detailCoords[0].y)}>
                                                            ℹ️
                                                        </button>
                                                    </td>
                                                    {index === 0 && (
                                                        <td>
                                                            <button onClick={handleNextStep}>Execute →</button>
                                                            <button onClick={handleSkipStep}>Skip</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );

                                        case "NAVIGATE":
                                            return (
                                                <tr key={index}>
                                                    <td>Navigate</td>
                                                    <td>{details.url}</td>
                                                    {index === 0 && (
                                                        <td>
                                                            <button onClick={handleNextStep}>Execute →</button>
                                                            <button onClick={handleSkipStep}>Skip</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );

                                        case "SCROLL":
                                            return (
                                                <tr key={index}>
                                                    <td>Scroll</td>
                                                    <td>DeltaY: {details.deltaY}</td>
                                                    {index === 0 && (
                                                        <td>
                                                            <button onClick={handleNextStep}>Execute →</button>
                                                            <button onClick={handleSkipStep}>Skip</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );

                                        case "WAIT":
                                            return (
                                                <tr key={index}>
                                                    <td>Wait</td>
                                                    <td>{details as number / 1000} sec</td>
                                                    {index === 0 && (
                                                        <td>
                                                            <button onClick={handleNextStep}>Execute →</button>
                                                            <button onClick={handleSkipStep}>Skip</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        case "CONTEXT":
                                            return (
                                                <tr key={index}>
                                                    <td>
                                                        <strong>Context</strong>
                                                        <div style={{ fontSize: '0.9em', color: '#666' }}>{details.prompt}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ maxWidth: '400px', maxHeight: '100px', overflow: 'auto' }}>
                                                            Crop Area: [{details.multiCoords?.map((c: any) => `(${c.x},${c.y})`).join(' → ')}]
                                                        </div>
                                                    </td>
                                                    {index === 0 && (
                                                        <td>
                                                            <button onClick={handleNextStep}>Next →</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        default:
                                            return null;
                                    }
                                })}
                            </tbody>
                        </table>
                    )}

                    <div className="steps-actions">
                        <button onClick={handleExecuteAll}>
                            {(!editedData || editedData.length === 0) ? "Next" : "Execute All"}
                        </button>
                        <button onClick={handleSkipAll}>Skip All</button>

                        <button onClick={() => setShowData(false)}>Cancel</button>
                    </div>
                </div>
            )}
        </>
    );
}

export default StepsBottomSection;