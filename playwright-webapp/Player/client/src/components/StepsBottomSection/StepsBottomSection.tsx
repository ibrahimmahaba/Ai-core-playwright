import type { Action, ReplayPixelOutput, StepsBottomSectionProps } from "../../types";
import { runPixel } from "@semoss/sdk";
import './StepsBottomSection.css';

function StepsBottomSection(props : StepsBottomSectionProps) {
    const {
        showData, setShowData, lastPage, setIsLastPage, editedData,
        overlay, setOverlay, sessionId, selectedRecording, 
        setLoading, insightId, setEditedData, updatedData, setUpdatedData, setShot,
        setHighlight, initialParamValues
    } = props

    const showHighlight = (x: number, y: number) => {
        setHighlight({ x, y });
        setTimeout(() => setHighlight(null), 4000); 
      }

    // Handles: "monday" -> "Monday", "attendance_hours_entry_for_tuesday" -> "Attendance Hours entry for Tuesday"
    function normalizeParamValues(actions: Action[], mcpParams: Record<string, string>): Record<string, string> {
        const normalized: Record<string, string> = {};
        
        // Extract all TYPE action labels from the recording
        const recordingLabels = actions
          .filter(action => "TYPE" in action)
          .map(action => action.TYPE.label);
        
        // For each MCP parameter, try to match it to a recording label
        Object.entries(mcpParams).forEach(([mcpKey, value]) => {
          // Try exact match first
          if (recordingLabels.includes(mcpKey)) {
            normalized[mcpKey] = value;
            return;
          }
          
          // Try case-insensitive match
          const caseInsensitiveMatch = recordingLabels.find(
            label => label.toLowerCase() === mcpKey.toLowerCase()
          );
          if (caseInsensitiveMatch) {
            normalized[caseInsensitiveMatch] = value;
            return;
          }
          
          // Try converting snake_case to proper label format
          // "attendance_hours_entry_for_tuesday" -> "Attendance Hours entry for Tuesday"
          const snakeCaseMatch = recordingLabels.find(label => {
            // Remove all spaces and convert to lowercase for comparison
            const labelNormalized = label.toLowerCase().replace(/\s+/g, '_');
            return labelNormalized === mcpKey.toLowerCase();
          });
          if (snakeCaseMatch) {
            normalized[snakeCaseMatch] = value;
            return;
          }
          
          // If no match found, keep the original key (backend will handle or ignore)
          console.warn(`Could not match MCP parameter "${mcpKey}" to any recording label`);
          normalized[mcpKey] = value;
        });
        
        console.log("Normalized param values in StepsBottomSection:", normalized);
        return normalized;
    }

    async function handleNextStep() {
        const nextAction = editedData[0];
        let pixel;
        if ("TYPE" in nextAction) {
          // Determine the value to use: overlay draft value, MCP value, or original value
          let valueToUse = nextAction.TYPE.text; // default to original
          
          // First priority: overlay draft value (user edited)
          if (overlay && overlay.draftValue !== undefined) {
            valueToUse = overlay.draftValue;
            nextAction.TYPE.text = overlay.draftValue;
          } 
          // Second priority: MCP parameter value (if available and not overridden by user)
          else if (initialParamValues && Object.keys(initialParamValues).length > 0) {
            const normalizedParams = normalizeParamValues(editedData, initialParamValues);
            if (normalizedParams[nextAction.TYPE.label]) {
              valueToUse = normalizedParams[nextAction.TYPE.label];
              nextAction.TYPE.text = valueToUse;
            }
          }
          
          const { label } = nextAction.TYPE;
          let paramValues = { [label]: valueToUse };
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", paramValues=[${JSON.stringify(paramValues)}], executeAll=false);`;
          setOverlay(null);
        } else {
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", executeAll=false);`;
        }
        setLoading(true);
        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };
    
        // Update editedData with the new data that includes coords and probe
        const newEditedData = editedData.slice(1);
        if (!newEditedData || newEditedData.length === 0) {
          setEditedData(output.actions);
          setUpdatedData(output.actions);
    
        } else {
          // Merge the server response data (coords, probe) with existing editedData
          const updatedEditedData = newEditedData.map((action, index) => {
            if (output.actions[index]) {
              return { ...action, ...output.actions[index] };
            }
            return action;
          });
          setEditedData(updatedEditedData);
        }
        setLoading(false);
        setUpdatedData(output.actions);
        setShowData(true);
        setIsLastPage(output.isLastPage);
        setShot(output.screenshot);
    }

    async function handleExecuteAll() {
        setLoading(true);
        
        // Build parameter values, prioritizing MCP values over original recording values
        const result: Record<string, string> = {};
        
        // First, get normalized MCP parameters if available
        let normalizedParams: Record<string, string> = {};
        if (initialParamValues && Object.keys(initialParamValues).length > 0) {
            normalizedParams = normalizeParamValues(updatedData, initialParamValues);
        }
        
        // Build the final parameter map
        updatedData.forEach(action => {
            if ("TYPE" in action) {
                const label = action.TYPE.label;
                // Use MCP value if available, otherwise use current text
                result[label] = normalizedParams[label] || action.TYPE.text;
            }
        });
    
        let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", executeAll=true, paramValues=${JSON.stringify(result)});`;
        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };
    
        setLoading(false);
        setEditedData(output.actions);
        setUpdatedData(output.actions);
        setShowData(true);
        setIsLastPage(output.isLastPage);
        setShot(output.screenshot);
      }

      async function handleSkipStep() {
        

        let pixel = `SkipStep (sessionId = "${sessionId}", fileName = "${selectedRecording}");`;
        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };
        setEditedData(output.actions);
        setIsLastPage(output.isLastPage);
        setOverlay(null);
    }

    function handleSkipAll() {
        setEditedData([]);
        setUpdatedData([]);
        setShowData(false);
        setOverlay(null);
    }

    return (
        <>
            {showData && !lastPage && (
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
                                    const type = Object.keys(action)[0] as keyof Action;
                                    const details = action[type] as any;
                                    const detailCoords = details?.coords
                                        ? { x: details.coords.x, y: details.coords.y }
                                        : details.x
                                            ? { x: details.x, y: details.y }
                                            : { x: 0, y: 0 };

                                    switch (type) {
                                        case "TYPE":
                                            // Determine what value will be used
                                            let displayValue = details.text; // default to original
                                            if (initialParamValues && Object.keys(initialParamValues).length > 0) {
                                                const normalizedParams = normalizeParamValues(editedData, initialParamValues);
                                                if (normalizedParams[details.label]) {
                                                    displayValue = normalizedParams[details.label];
                                                }
                                            }
                                            
                                            return (
                                                <tr key={index}>
                                                    <td>{details.label}</td>
                                                    <td style={{ 
                                                        fontWeight: displayValue !== details.text ? 'bold' : 'normal',
                                                        color: displayValue !== details.text ? '#1976d2' : 'inherit'
                                                    }}>
                                                        {displayValue || '(empty)'}
                                                        {displayValue !== details.text && (
                                                            <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '8px' }}>
                                                                (MCP: {displayValue})
                                                            </span>
                                                        )}
                                                    </td>
                                                    {index === 0 && (
                                                        <td>
                                                            <button onClick={handleNextStep}>Execute →</button>
                                                            <button onClick={() => handleSkipStep()}>Skip</button>
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
                                                            <button onClick={() => handleSkipStep()}>Skip</button>
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
                                                            <button onClick={() => handleSkipStep()}>Skip</button>
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
                                                            <button onClick={() => handleSkipStep()}>Skip</button>
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
                                                            <button onClick={() => handleSkipStep()}>Skip</button>
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