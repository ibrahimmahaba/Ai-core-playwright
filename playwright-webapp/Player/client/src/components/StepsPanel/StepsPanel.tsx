import type { Action, Step, TabData } from "../../types";
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
  tabs?: TabData[];
  activeTabId?: string;
}

function StepsPanel(props: StepsPanelProps) {
  const { steps, editedData, sessionId, insightId, selectedRecording, tabs, activeTabId } = props;
  const [editedValues, setEditedValues] = useState<Record<number, { [key: string]: string }>>({});
  const [loadedSteps, setLoadedSteps] = useState<Step[]>([]);
  const [loadedStepsByTab, setLoadedStepsByTab] = useState<Record<string, Step[]>>({});
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
        console.log("GetAllSteps full response:", JSON.stringify(res, null, 2));
        
        // Handle different possible response structures
        let allSteps: Step[] = [];
        let stepsByTab: Record<string, Step[]> = {};
        
        if (!res) {
          console.warn("GetAllSteps: No response received");
        } else if (!res.pixelReturn || res.pixelReturn.length === 0) {
          console.warn("GetAllSteps: No pixelReturn in response", res);
        } else {
          const pixelReturn = res.pixelReturn[0];
          console.log("GetAllSteps pixelReturn:", JSON.stringify(pixelReturn, null, 2));
          
          // Try different response structures
          if (pixelReturn.output !== undefined) {
            const output = pixelReturn.output;
            console.log("GetAllSteps output type:", typeof output);
            console.log("GetAllSteps output:", JSON.stringify(output, null, 2));
            
            // Case 1: output.tabs - steps organized by tabs
            if (output && typeof output === 'object' && output.tabs && Array.isArray(output.tabs)) {
              console.log(`Found ${output.tabs.length} tabs in output.tabs`);
              output.tabs.forEach((tab: any) => {
                if (tab.id && tab.steps && Array.isArray(tab.steps)) {
                  stepsByTab[tab.id] = tab.steps;
                  allSteps = allSteps.concat(tab.steps);
                  console.log(`✓ Tab ${tab.id}: ${tab.steps.length} steps`);
                }
              });
            }
            // Case 2: output is an object with tabIds as keys
            else if (output && typeof output === 'object' && !Array.isArray(output)) {
              console.log("Checking if output contains tabs as keys...");
              for (const key in output) {
                const value = output[key];
                if (Array.isArray(value) && value.length > 0) {
                  const firstItem = value[0];
                  // Check if it looks like steps array (has type property)
                  if (firstItem && typeof firstItem === 'object' && firstItem.type) {
                    // If key looks like a tabId (starts with "tab-" or is a tab identifier)
                    if (key.startsWith('tab-') || key.includes('tab') || tabs?.some(t => t.id === key)) {
                      stepsByTab[key] = value;
                      allSteps = allSteps.concat(value);
                      console.log(`✓ Tab ${key}: ${value.length} steps`);
                    } else {
                      // Otherwise treat as a single steps array
                      allSteps = value;
                      console.log(`✓ Found ${allSteps.length} steps in output.${key}`);
                      break;
                    }
                  }
                }
              }
            }
            // Case 3: output.steps (StepsEnvelope structure) - single array
            else if (output && typeof output === 'object' && output.steps && Array.isArray(output.steps)) {
              allSteps = output.steps;
              console.log(`✓ Found ${allSteps.length} steps in output.steps`);
            }
            // Case 4: output is directly an array of steps
            else if (Array.isArray(output)) {
              allSteps = output;
              console.log(`✓ Found ${allSteps.length} steps in output array`);
            }
            // Case 5: output might be a StepsEnvelope with version and steps
            else if (output && typeof output === 'object' && output.version && output.steps && Array.isArray(output.steps)) {
              allSteps = output.steps;
              console.log(`✓ Found ${allSteps.length} steps in StepsEnvelope`);
            }
            // Case 6: Check if output has nested structure - search all properties
            else if (output && typeof output === 'object' && output !== null) {
              console.log("Searching output object for steps array...");
              // Try to find steps in any property
              for (const key in output) {
                const value = output[key];
                console.log(`Checking output.${key}:`, typeof value, Array.isArray(value) ? `array[${value.length}]` : 'not array');
                
                if (Array.isArray(value) && value.length > 0) {
                  // Check if it looks like steps array (has type property)
                  const firstItem = value[0];
                  if (firstItem && typeof firstItem === 'object' && firstItem.type) {
                    allSteps = value;
                    console.log(`✓ Found ${allSteps.length} steps in output.${key}`);
                    break;
                  }
                }
              }
              
              // If still no steps found, log all keys for debugging
              if (allSteps.length === 0) {
                console.log("Available keys in output:", Object.keys(output));
                console.log("Output structure:", output);
              }
            }
          }
          // Case 7: pixelReturn might directly contain steps
          else if (Array.isArray(pixelReturn)) {
            allSteps = pixelReturn;
            console.log(`✓ Found ${allSteps.length} steps directly in pixelReturn`);
          }
          // Case 8: Check pixelReturn properties directly
          else if (pixelReturn && typeof pixelReturn === 'object') {
            console.log("Checking pixelReturn object properties...");
            for (const key in pixelReturn) {
              const value = pixelReturn[key];
              if (Array.isArray(value) && value.length > 0) {
                const firstItem = value[0];
                if (firstItem && typeof firstItem === 'object' && firstItem.type) {
                  allSteps = value;
                  console.log(`✓ Found ${allSteps.length} steps in pixelReturn.${key}`);
                  break;
                }
              }
            }
            if (allSteps.length === 0) {
              console.log("Available keys in pixelReturn:", Object.keys(pixelReturn));
            }
          }
        }
        
        console.log(`Total steps to display: ${allSteps.length}`);
        console.log(`Steps by tab:`, stepsByTab);
        if (allSteps.length > 0) {
          console.log("First step example:", allSteps[0]);
        }
        
        // If we have steps organized by tab, use those; otherwise use the flat array
        if (Object.keys(stepsByTab).length > 0) {
          setLoadedStepsByTab(stepsByTab);
          // Flatten all steps from all tabs for display
          const allStepsFromTabs = Object.values(stepsByTab).flat();
          setLoadedSteps(allStepsFromTabs);
        } else {
          setLoadedSteps(allSteps);
          setLoadedStepsByTab({});
        }
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
  const hasLoadedStepsByTab = Object.keys(loadedStepsByTab).length > 0;
  const hasEditedData = editedData && editedData.length > 0;
  const hasSteps = steps && steps.length > 0;

  // If we have steps organized by tabs, show them grouped by tab
  const renderStepsByTab = () => {
    if (!hasLoadedStepsByTab) return null;
    
    return Object.entries(loadedStepsByTab).map(([tabId, tabSteps]) => {
      const tab = tabs?.find(t => t.id === tabId);
      const tabTitle = tab?.title || tabId;
      const stepsArray = tabSteps as Step[];
      
      return (
        <div key={tabId} className="steps-tab-group">
          <h4 className="steps-tab-title">{tabTitle} ({stepsArray.length} steps)</h4>
          <div className="steps-list">
            {stepsArray.map((step, index) => renderStep(step, index))}
          </div>
        </div>
      );
    });
  };

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
            {hasLoadedStepsByTab ? (
              <>
                <h3 className="steps-panel-section-title">All Steps ({loadedSteps.length})</h3>
                {renderStepsByTab()}
              </>
            ) : (
              <>
                <h3 className="steps-panel-section-title">Steps ({loadedSteps.length})</h3>
                <div className="steps-list">
                  {loadedSteps.map((step, index) => renderStep(step, index))}
                </div>
              </>
            )}
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

