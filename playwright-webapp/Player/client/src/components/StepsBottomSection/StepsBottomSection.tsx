import type { Action, ReplayPixelOutput, StepsBottomSectionProps } from "../../types";
import { runPixel } from "@semoss/sdk";

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
            <div style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>Edit Replay Variables </h4>
                </div>

                {!editedData || editedData.length === 0 ? (
                    <div>No variables found.</div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                        <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}>Label</th>
                        <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}>Value</th>
                        <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {editedData.map((action, index) => {
                        const type = Object.keys(action)[0] as keyof Action;
                        const details = action[type] as any;

                        switch (type) {
                            case "TYPE":
                            return (
                                <tr key={index}>
                                <td style={{textAlign: "start"}} >{details.label}</td>
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
                                <tr key={index} style={{textAlign: "start"}}>
                                <td >Click</td>
                                <td>
                                    ({details.x}, {details.y})
                                    <button onClick={() => showHighlight(details.x, details.y)}>
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
                                <tr key={index} style={{textAlign: "start"}}>
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
                                <tr key={index} style={{textAlign: "start"}}>
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
                                <tr key={index} style={{textAlign: "start"}}>
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

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
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