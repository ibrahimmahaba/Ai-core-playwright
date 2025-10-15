import type { Action, ReplayPixelOutput, StepsBottomSectionProps } from "../../types";
import { runPixel } from "@semoss/sdk";
import './StepsBottomSection.css';

function StepsBottomSection(props : StepsBottomSectionProps) {
    const {
        showData, setShowData, lastPage, setIsLastPage, editedData,
        overlay, setOverlay, sessionId, selectedRecording, 
        setLoading, insightId, setEditedData, updatedData, setUpdatedData, setShot,
        setHighlight
    } = props

    const showHighlight = (x: number, y: number) => {
        setHighlight({ x, y });
        setTimeout(() => setHighlight(null), 4000); 
      }
    async function handleNextStep() {
        const nextAction = editedData[0];
        let pixel;
        if ("TYPE" in nextAction) {
          // Use the draftValue and draftLabel from overlay if available
          if (overlay && overlay.draftValue !== undefined) {
            nextAction.TYPE.text = overlay.draftValue;
          }
          const { label, text } = nextAction.TYPE;
          let paramValues = { [label]: text };
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
        const result = updatedData.reduce<Record<string, string>[]>((acc, action) => {
          if ("TYPE" in action) {
            acc.push({ [action.TYPE.label]: action.TYPE.text });
          }
          return acc;
        }, []);
    
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

  return (
    <>
        {showData && !lastPage && (
            <div className="steps-container">
                <div className="steps-header">
                <h4>Edit Replay Variables </h4>
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
                        console.log("Rendering action:", action);
                        console.log("Type:", type, "Details:", details);

                        switch (type) {
                            case "TYPE":
                            return (
                                <tr key={index}>
                                <td>{details.label}</td>
                                <td></td>
                                {index === 0 && (
                                    <td>
                                    <button onClick={handleNextStep}>Execute →</button>
                                    </td>
                                )}
                                </tr>
                            );

                            case "CLICK":
                            return (
                                <tr key={index}>
                                <td >Click</td>
                                <td>
                                  ({detailCoords.x}, {detailCoords.y})
                                  <button onClick={() => showHighlight(detailCoords.x, detailCoords.y)}>
                                    ℹ️
                                    </button>
                                </td>
                                {index === 0 && (
                                    <td>
                                    <button onClick={handleNextStep}>Execute →</button>
                                    </td>
                                )}
                                </tr>
                            );

                            case "NAVIGATE":
                            return (
                                <tr key={index}>
                                <td >Navigate</td>
                                <td>{details.url}</td>
                                {index === 0 && (
                                    <td>
                                    <button onClick={handleNextStep}>Execute →</button>
                                    </td>
                                )}
                                </tr>
                            );

                            case "SCROLL":
                            return (
                                <tr key={index}>
                                <td >Scroll</td>
                                <td>DeltaY: {details.deltaY}</td>
                                {index === 0 && (
                                    <td>
                                    <button onClick={handleNextStep}>Execute →</button>
                                    </td>
                                )}
                                </tr>
                            );

                            case "WAIT":
                            return (
                                <tr key={index}>
                                <td >Wait</td>
                                <td>{details as number / 1000} sec</td>
                                {index === 0 && (
                                    <td>
                                    <button onClick={handleNextStep}>Execute →</button>
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
                    <button
                    onClick={handleExecuteAll}
                    >
                    {(!editedData || editedData.length === 0) ? "Next" : "Execute All"}
                    </button>

                    <button onClick={() => setShowData(false)}>Cancel</button>
                </div>
            </div>
        )}
    </>
  )
}

export default StepsBottomSection