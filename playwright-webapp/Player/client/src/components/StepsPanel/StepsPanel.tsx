import type { Action, Step } from "../../types";
import './StepsPanel.css';

interface StepsPanelProps {
  steps: Step[];
  editedData: Action[];
}

function StepsPanel(props: StepsPanelProps) {
  const { steps, editedData } = props;

  const renderStep = (step: Step, index: number) => {
    switch (step.type) {
      case "CLICK":
        return (
          <div key={index} className="step-item">
            <div className="step-type">CLICK</div>
            <div className="step-details">
              <div>Coordinates: ({step.coords.x}, {step.coords.y})</div>
              {step.selector && (
                <div>Selector: {step.selector.strategy} - {step.selector.value}</div>
              )}
            </div>
          </div>
        );
      case "TYPE":
        return (
          <div key={index} className="step-item">
            <div className="step-type">TYPE</div>
            <div className="step-details">
              <div>Text: {step.text}</div>
              {step.label && <div>Label: {step.label}</div>}
              {step.selector && (
                <div>Selector: {step.selector.strategy} - {step.selector.value}</div>
              )}
            </div>
          </div>
        );
      case "SCROLL":
        return (
          <div key={index} className="step-item">
            <div className="step-type">SCROLL</div>
            <div className="step-details">
              <div>Delta Y: {step.deltaY ?? 0}</div>
            </div>
          </div>
        );
      case "WAIT":
        return (
          <div key={index} className="step-item">
            <div className="step-type">WAIT</div>
            <div className="step-details">
              <div>Duration: {step.waitAfterMs}ms</div>
            </div>
          </div>
        );
      case "NAVIGATE":
        return (
          <div key={index} className="step-item">
            <div className="step-type">NAVIGATE</div>
            <div className="step-details">
              <div>URL: {step.url}</div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderAction = (action: Action, index: number) => {
    if ("TYPE" in action) {
      return (
        <div key={index} className="step-item">
          <div className="step-type">TYPE</div>
          <div className="step-details">
            <div>Label: {action.TYPE.label}</div>
            <div>Text: {action.TYPE.isPassword ? "••••••••" : action.TYPE.text}</div>
          </div>
        </div>
      );
    }
    if ("CLICK" in action) {
      return (
        <div key={index} className="step-item">
          <div className="step-type">CLICK</div>
          <div className="step-details">
            <div>Coordinates: ({action.CLICK.coords.x}, {action.CLICK.coords.y})</div>
          </div>
        </div>
      );
    }
    if ("SCROLL" in action) {
      return (
        <div key={index} className="step-item">
          <div className="step-type">SCROLL</div>
          <div className="step-details">
            <div>Delta Y: {action.SCROLL.deltaY}</div>
          </div>
        </div>
      );
    }
    if ("WAIT" in action) {
      return (
        <div key={index} className="step-item">
          <div className="step-type">WAIT</div>
          <div className="step-details">
            <div>Duration: {action.WAIT}ms</div>
          </div>
        </div>
      );
    }
    if ("NAVIGATE" in action) {
      return (
        <div key={index} className="step-item">
          <div className="step-type">NAVIGATE</div>
          <div className="step-details">
            <div>URL: {action.NAVIGATE}</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="steps-panel">
      <div className="steps-panel-content">
        <a className="tools-header-tag">STEPS</a>
        {editedData && editedData.length > 0 ? (
          <>
            <h3 className="steps-panel-section-title">Actions ({editedData.length})</h3>
            <div className="steps-list">
              {editedData.map((action, index) => renderAction(action, index))}
            </div>
          </>
        ) : steps && steps.length > 0 ? (
          <>
            <h3 className="steps-panel-section-title">Steps ({steps.length})</h3>
            <div className="steps-list">
              {steps.map((step, index) => renderStep(step, index))}
            </div>
          </>
        ) : (
          <div className="steps-panel-empty">
            <p>No steps available</p>
            <p className="steps-panel-empty-hint">Steps will appear here when actions are added</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StepsPanel;

