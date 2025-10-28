import type { Action, ReplayPixelOutput, StepsBottomSectionProps, Viewport } from "../../types";
import { runPixel } from "@semoss/sdk";
import './StepsBottomSection.css';
import { useSendStep } from "../../hooks/useSendStep";
import { preferSelectorFromProbe } from "../../hooks/usePreferSelector";
import { useProbeAt } from "../../hooks/useProbeAt";
import { useSkipStep } from "../../hooks/useSkipStep";


function StepsBottomSection(props : StepsBottomSectionProps) {
    const {
        showData, setShowData, setIsLastPage, editedData,
        overlay, setOverlay, sessionId, selectedRecording, 
        setLoading, insightId, setEditedData, updatedData, setUpdatedData, setShot,
        setHighlight, steps, setSteps, shot, activeTabId, tabs, setTabs , setActiveTabId
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
          if (tabs && setTabs && activeTabId) {
            setTabs(prevTabs => prevTabs.map(tab => {
              if (tab.id === actionTabId) {
                return { ...tab, actions: tab.actions.slice(1) };
              }
              return tab;
            }));
          }
          
          // Update display
          const newEditedData = editedData.slice(1);
          setEditedData(newEditedData);
          
          if (output.actions && output.actions.length > 0) {
            setUpdatedData(output.actions);
          } else {
            setUpdatedData(newEditedData);
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

    return (
        <>
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
                                        ? { x: details.coords.x, y: details.coords.y }
                                        : details.x
                                            ? { x: details.x, y: details.y }
                                            : { x: 0, y: 0 };

                                    switch (type) {
                                        case "TYPE":
                                            return (
                                                <tr key={index}>
                                                    <td>{details.label}</td>
                                                    <td></td>
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
                                                        ({detailCoords.x}, {detailCoords.y})
                                                        <button onClick={() => showHighlight(detailCoords.x, detailCoords.y)}>
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