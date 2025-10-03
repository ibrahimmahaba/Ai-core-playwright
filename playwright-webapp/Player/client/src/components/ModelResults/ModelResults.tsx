import type { ModelResultsProps } from "../../types"
import './ModelResults.css';

function ModelResults(props : ModelResultsProps) {
    const {
        showModelResults, modelGeneratedSteps, setShowModelResults
    } = props

    
  return (
    <>
        {showModelResults && modelGeneratedSteps && (
            <div className="model-results-container">
            <div className="model-results-content">
                <h3>Model Generated Steps</h3>
                <pre className="model-results-pre">
                {modelGeneratedSteps.stepsJson || modelGeneratedSteps.rawResponse}
                </pre>
                <div className="model-results-actions">
                <button onClick={() => setShowModelResults(false)}>Close</button>
                </div>
            </div>
            </div>
        )}
    </>
  )
}

export default ModelResults