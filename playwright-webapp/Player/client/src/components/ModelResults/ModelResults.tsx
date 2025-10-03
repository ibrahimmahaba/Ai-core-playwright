import type { ModelResultsProps } from "../../types"

function ModelResults(props : ModelResultsProps) {
    const {
        showModelResults, modelGeneratedSteps, setShowModelResults
    } = props

    
  return (
    <>
        {showModelResults && modelGeneratedSteps && (
            <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 10000,
            color: "black"
            }}>
            <div style={{
                background: "white", padding: "24px", borderRadius: "8px",
                maxWidth: "700px", maxHeight: "80vh", overflow: "auto",
            }}>
                <h3>Model Generated Steps</h3>
                <pre style={{ background: "#f5f5f5", padding: "12px", borderRadius: "4px" }}>
                {modelGeneratedSteps.stepsJson || modelGeneratedSteps.rawResponse}
                </pre>
                <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                <button onClick={() => setShowModelResults(false)}>Close</button>
                </div>
            </div>
            </div>
        )}
    </>
  )
}

export default ModelResults