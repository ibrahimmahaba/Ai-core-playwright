import type { Action, Step } from "../../types";
import './StepsPanel.css';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import { Info as InfoIcon, Mouse as ClickIcon } from "@mui/icons-material";
import { useState, useEffect } from 'react';
import { runPixel } from "@semoss/sdk";

interface StepsPanelProps {
  steps: Step[];
  editedData: Action[];
  sessionId?: string;
  insightId?: string;
  selectedRecording?: string | null;
}

function StepsPanel(props: StepsPanelProps) {
  const { steps, editedData, sessionId, insightId, selectedRecording } = props;
  const [editedValues, setEditedValues] = useState<Record<number, { [key: string]: string }>>({});
  const [loadedSteps, setLoadedSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);

  // Call GetAllSteps when panel opens (component mounts) or when selectedRecording changes
  useEffect(() => {
    async function fetchSteps() {
      if (!sessionId || !insightId || !selectedRecording) {
        setLoadedSteps([]);
        return;
      }

      setLoading(true);
      try {
        const pixel = `GetAllSteps(sessionId="${sessionId}", fileName="${selectedRecording}")`;
        console.log("Fetching steps with pixel:", pixel);
        const res = await runPixel(pixel, insightId);
        console.log("GetAllSteps full response:", res);
        
        // Handle different possible response structures
        let allSteps: Step[] = [];
        
        if (res && res.pixelReturn && res.pixelReturn.length > 0) {
          const pixelReturn = res.pixelReturn[0];
          console.log("GetAllSteps pixelReturn:", pixelReturn);
          
          // Try different response structures
          if (pixelReturn.output) {
            const output = pixelReturn.output;
            console.log("GetAllSteps output:", output);
            
            // Case 1: output.steps (StepsEnvelope structure)
            if (output.steps && Array.isArray(output.steps)) {
              allSteps = output.steps;
              console.log(`Found ${allSteps.length} steps in output.steps`);
            }
            // Case 2: output is directly an array of steps
            else if (Array.isArray(output)) {
              allSteps = output;
              console.log(`Found ${allSteps.length} steps in output array`);
            }
            // Case 3: output might be a StepsEnvelope with version and steps
            else if (output.version && output.steps && Array.isArray(output.steps)) {
              allSteps = output.steps;
              console.log(`Found ${allSteps.length} steps in StepsEnvelope`);
            }
            // Case 4: Check if output has nested structure
            else if (typeof output === 'object') {
              // Try to find steps in any property
              for (const key in output) {
                if (Array.isArray(output[key]) && output[key].length > 0) {
                  // Check if it looks like steps array
                  const potentialSteps = output[key];
                  if (potentialSteps[0] && potentialSteps[0].type) {
                    allSteps = potentialSteps;
                    console.log(`Found ${allSteps.length} steps in output.${key}`);
                    break;
                  }
                }
              }
            }
          }
          // Case 5: pixelReturn might directly contain steps
          else if (Array.isArray(pixelReturn)) {
            allSteps = pixelReturn;
            console.log(`Found ${allSteps.length} steps directly in pixelReturn`);
          }
        }
        
        console.log(`Total steps to display: ${allSteps.length}`);
        setLoadedSteps(allSteps);
      } catch (err) {
        console.error("Error fetching steps from GetAllSteps:", err);
        setLoadedSteps([]);
      } finally {
        setLoading(false);
      }
    }

    // Always fetch when component mounts (panel opens) or when selectedRecording changes
    fetchSteps();
  }, [sessionId, insightId, selectedRecording]);

  const handleValueChange = (index: number, field: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  const getValue = (index: number, field: string, defaultValue: string) => {
    return editedValues[index]?.[field] ?? defaultValue;
  };

  const renderStep = (step: Step, index: number) => {
    const stepNumber = index + 1;
    
    switch (step.type) {
      case "CLICK":
        return (
          <div key={index} className="step-item step-item-click">
            <div className="step-checkbox">
              <Checkbox defaultChecked />
            </div>
            <div className="step-number">{stepNumber}</div>
            <div className="step-content step-content-click">
              <div className="step-type-label">CLICK</div>
              <div className="step-click-icons">
                <InfoIcon className="step-info-icon" />
                <ClickIcon className="step-click-icon" />
              </div>
            </div>
          </div>
        );
      case "TYPE":
        const currentText = getValue(index, 'text', step.isPassword ? "••••••••" : step.text);
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-checkbox">
              <Checkbox defaultChecked />
            </div>
            <div className="step-number">{stepNumber}</div>
            <div className="step-content">
              <div className="step-title">{step.label || 'Input'}</div>
              <TextField
                id={`type-field-${index}`}
                value={currentText}
                onChange={(e) => handleValueChange(index, 'text', e.target.value)}
                disabled={step.isPassword}
                size="small"
                sx={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>
        );
      case "SCROLL":
        const currentDeltaY = getValue(index, 'deltaY', String(step.deltaY ?? 0));
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-checkbox">
              <Checkbox defaultChecked />
            </div>
            <div className="step-number">{stepNumber}</div>
            <div className="step-content">
              <div className="step-title">SCROLL</div>
              <TextField
                id={`scroll-field-${index}`}
                value={currentDeltaY}
                onChange={(e) => handleValueChange(index, 'deltaY', e.target.value)}
                label="Delta Y"
                size="small"
                type="number"
                sx={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>
        );
      case "WAIT":
        const currentWait = getValue(index, 'wait', String(step.waitAfterMs ?? 0));
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-checkbox">
              <Checkbox defaultChecked />
            </div>
            <div className="step-number">{stepNumber}</div>
            <div className="step-content">
              <div className="step-title">WAIT</div>
              <TextField
                id={`wait-field-${index}`}
                value={currentWait}
                onChange={(e) => handleValueChange(index, 'wait', e.target.value)}
                label="Duration (ms)"
                size="small"
                type="number"
                sx={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>
        );
      case "NAVIGATE":
        const currentUrl = getValue(index, 'url', step.url);
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-checkbox">
              <Checkbox defaultChecked />
            </div>
            <div className="step-number">{stepNumber}</div>
            <div className="step-content">
              <div className="step-title">NAVIGATE</div>
              <TextField
                id={`navigate-field-${index}`}
                value={currentUrl}
                onChange={(e) => handleValueChange(index, 'url', e.target.value)}
                label="URL"
                size="small"
                sx={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderAction = (action: Action, index: number) => {
    const stepNumber = index + 1;
    
    if ("TYPE" in action) {
      const currentText = getValue(index, 'text', action.TYPE.isPassword ? "••••••••" : action.TYPE.text);
      
      return (
        <div key={index} className="step-item step-item-type">
          <div className="step-checkbox">
            <Checkbox defaultChecked />
          </div>
          <div className="step-number">{stepNumber}</div>
          <div className="step-content">
            <div className="step-title">{action.TYPE.label || 'Input'}</div>
            <TextField
              id={`type-field-${index}`}
              value={currentText}
              onChange={(e) => handleValueChange(index, 'text', e.target.value)}
              disabled={action.TYPE.isPassword}
              size="small"
              sx={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>
      );
    }
    
    if ("CLICK" in action) {
      return (
        <div key={index} className="step-item step-item-click">
          <div className="step-checkbox">
            <Checkbox defaultChecked />
          </div>
          <div className="step-number">{stepNumber}</div>
          <div className="step-content step-content-click">
            <div className="step-type-label">CLICK</div>
            <div className="step-click-icons">
              <InfoIcon className="step-info-icon" />
              <ClickIcon className="step-click-icon" />
            </div>
          </div>
        </div>
      );
    }
    
    if ("SCROLL" in action) {
      const currentDeltaY = getValue(index, 'deltaY', String(action.SCROLL.deltaY));
      
      return (
        <div key={index} className="step-item step-item-type">
          <div className="step-checkbox">
            <Checkbox defaultChecked />
          </div>
          <div className="step-number">{stepNumber}</div>
          <div className="step-content">
            <div className="step-title">SCROLL</div>
            <TextField
              id={`scroll-field-${index}`}
              value={currentDeltaY}
              onChange={(e) => handleValueChange(index, 'deltaY', e.target.value)}
              label="Delta Y"
              size="small"
              type="number"
              sx={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>
      );
    }
    
    if ("WAIT" in action) {
      const currentWait = getValue(index, 'wait', String(action.WAIT));
      
      return (
        <div key={index} className="step-item step-item-type">
          <div className="step-checkbox">
            <Checkbox defaultChecked />
          </div>
          <div className="step-number">{stepNumber}</div>
          <div className="step-content">
            <div className="step-title">WAIT</div>
            <TextField
              id={`wait-field-${index}`}
              value={currentWait}
              onChange={(e) => handleValueChange(index, 'wait', e.target.value)}
              label="Duration (ms)"
              size="small"
              type="number"
              sx={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>
      );
    }
    
    if ("NAVIGATE" in action) {
      const currentUrl = getValue(index, 'url', action.NAVIGATE);
      
      return (
        <div key={index} className="step-item step-item-type">
          <div className="step-checkbox">
            <Checkbox defaultChecked />
          </div>
          <div className="step-number">{stepNumber}</div>
          <div className="step-content">
            <div className="step-title">NAVIGATE</div>
            <TextField
              id={`navigate-field-${index}`}
              value={currentUrl}
              onChange={(e) => handleValueChange(index, 'url', e.target.value)}
              label="URL"
              size="small"
              sx={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Determine which steps to display: loadedSteps from GetAllSteps > editedData > steps
  const hasLoadedSteps = loadedSteps.length > 0;
  const hasEditedData = editedData && editedData.length > 0;
  const hasSteps = steps && steps.length > 0;

  return (
    <div className="steps-panel">
      <div className="steps-panel-content">
        <a className="tools-header-tag">STEPS</a>
        {loading ? (
          <div className="steps-panel-empty">
            <p>Loading steps...</p>
          </div>
        ) : hasLoadedSteps ? (
          <>
            <h3 className="steps-panel-section-title">Steps ({loadedSteps.length})</h3>
            <div className="steps-list">
              {loadedSteps.map((step, index) => renderStep(step, index))}
            </div>
          </>
        ) : hasEditedData ? (
          <>
            <h3 className="steps-panel-section-title">Actions ({editedData.length})</h3>
            <div className="steps-list">
              {editedData.map((action, index) => renderAction(action, index))}
            </div>
          </>
        ) : hasSteps ? (
          <>
            <h3 className="steps-panel-section-title">Steps ({steps.length})</h3>
            <div className="steps-list">
              {steps.map((step, index) => renderStep(step, index))}
            </div>
          </>
        ) : (
          <div className="steps-panel-empty">
            <p>No steps available</p>
            <p className="steps-panel-empty-hint">
              {selectedRecording 
                ? `Select a recording file to view steps` 
                : `Steps will appear here when actions are added`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StepsPanel;

