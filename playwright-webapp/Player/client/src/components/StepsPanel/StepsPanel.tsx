import type { Action, Step, TabData } from "../../types";
import './StepsPanel.css';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import { Info as InfoIcon, Mouse as ClickIcon } from "@mui/icons-material";
import { useState, useEffect } from 'react';
import { useRef, useCallback } from 'react';
import { runPixel } from "@semoss/sdk";
import { Box, Button, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import AdsClickIcon from '@mui/icons-material/AdsClick';

interface StepsPanelProps {
  steps: Step[];
  editedData: Action[];
  sessionId?: string;
  insightId?: string;
  selectedRecording?: string | null;
  tabs?: TabData[];
  activeTabId?: string;
  setActiveTabId?: React.Dispatch<React.SetStateAction<string>>;
}

function StepsPanel(props: StepsPanelProps) {
  const { steps, editedData, sessionId, insightId, selectedRecording, tabs, activeTabId, setActiveTabId } = props;
  const [editedValues, setEditedValues] = useState<Record<number, { [key: string]: string }>>({});
  const [loadedSteps, setLoadedSteps] = useState<Step[]>([]);
  const [loadedStepsByTab, setLoadedStepsByTab] = useState<Record<string, Step[]>>({});
  const [loading, setLoading] = useState(false);
  const [dirtyFields, setDirtyFields] = useState<Record<number, Set<string>>>({});
  const isFetchingRef = useRef(false);
  const [selectedTabId, setSelectedTabId] = useState<string>(() => activeTabId || tabs?.[0]?.id || "");

  // Keep local selection in sync with external activeTabId (screen tabs)
  useEffect(() => {
    if (activeTabId && activeTabId !== selectedTabId) {
      setSelectedTabId(activeTabId);
      // Reset local edit caches when switching tabs
      setEditedValues({});
      setDirtyFields({});
    }
  }, [activeTabId]);

  // Remove editedData sync to avoid cursor jumps and always rely on GetAllSteps

  // Fetch steps (factored for reuse by polling)
  const fetchSteps = useCallback(async () => {
    if (!sessionId || !selectedRecording) {
      setLoadedSteps([]);
      setLoadedStepsByTab({});
      return;
    }

    setLoading(true);
    try {
      const pixel = `GetAllSteps(sessionId="${sessionId}", fileName="${selectedRecording}")`;
      const res = await runPixel(pixel, insightId);
      let allSteps: Step[] = [];
      let stepsByTab: Record<string, Step[]> = {};

      const pixelReturn = res?.pixelReturn?.[0];
      const output = pixelReturn?.output;
      if (output && typeof output === 'object' && output.steps && typeof output.steps === 'object' && !Array.isArray(output.steps)) {
        const stepsObj = output.steps;
        for (const tabId in stepsObj) {
          const tabData = stepsObj[tabId];
          if (tabData && typeof tabData === 'object') {
            if (Array.isArray(tabData.steps)) {
              stepsByTab[tabId] = tabData.steps;
              allSteps = allSteps.concat(tabData.steps);
            } else if (Array.isArray(tabData) && tabData.length > 0 && (tabData as any)[0]?.type) {
              stepsByTab[tabId] = tabData as Step[];
              allSteps = allSteps.concat(tabData as Step[]);
            }
          }
        }
      }

      if (Object.keys(stepsByTab).length > 0) {
        setLoadedStepsByTab(stepsByTab);
        setLoadedSteps(Object.values(stepsByTab).flat());
      } else {
        setLoadedSteps(allSteps);
        setLoadedStepsByTab({});
      }
    } catch (err) {
      console.error("Error fetching steps from GetAllSteps:", err);
      setLoadedSteps([]);
      setLoadedStepsByTab({});
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedRecording, insightId]);

  // Initial fetch and refetch when identifiers change
  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  // Disable periodic polling; we'll refetch only on user-initiated changes
  // (e.g., typing in text fields or switching tabs)
  const refetchTimeoutRef = useRef<number | null>(null);

  // Seed editedValues from currently displayed steps without overwriting fields user is actively editing
  useEffect(() => {
    const current = Object.keys(loadedStepsByTab).length > 0
      ? (loadedStepsByTab[selectedTabId] || [])
      : loadedSteps;
    if (!current || current.length === 0) return;

    setEditedValues(prev => {
      const next = { ...prev };
      current.forEach((step, index) => {
        const dirty = dirtyFields[index] || new Set<string>();
        if (step.type === 'TYPE') {
          if (!dirty.has('text')) {
            next[index] = { ...(next[index] || {}), text: step.isPassword ? '••••••••' : step.text };
          }
        } else if (step.type === 'SCROLL') {
          if (!dirty.has('deltaY')) {
            next[index] = { ...(next[index] || {}), deltaY: String(step.deltaY ?? 0) };
          }
        } else if (step.type === 'WAIT') {
          if (!dirty.has('wait')) {
            next[index] = { ...(next[index] || {}), wait: String(step.waitAfterMs ?? 0) };
          }
        } else if (step.type === 'NAVIGATE') {
          if (!dirty.has('url')) {
            next[index] = { ...(next[index] || {}), url: step.url };
          }
        }
      });
      return next;
    });
  }, [loadedSteps, loadedStepsByTab, selectedTabId]);

  const handleValueChange = (index: number, field: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [index]: {
        ...(prev[index] || {}),
        [field]: value
      }
    }));
    setDirtyFields(prev => {
      const copy = { ...prev };
      copy[index] = new Set(copy[index] || []);
      copy[index].add(field);
      return copy;
    });

    // Debounced refetch to sync from backend only when user edits
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }
    refetchTimeoutRef.current = window.setTimeout(async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        await fetchSteps();
      } finally {
        isFetchingRef.current = false;
      }
    }, 400);
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
              <Checkbox defaultChecked disabled />
            </div>
            
            <div className="step-content step-content-click">
            <div className="step-number">Step: {stepNumber}</div>
              <div className="step-type-label">CLICK</div>
              <InfoIcon className="step-info-icon" />
              <div className="step-click-icons">
                <AdsClickIcon className="step-click-icon" />
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
            <div className="step-content">
            <div className="step-number">Step: {stepNumber}</div>
              <div className="step-title">{step.label || 'Input'}</div>
              <TextField
                id={`type-field-${index}`}
                value={currentText}
                onChange={(e) => handleValueChange(index, 'text', e.target.value)}
                disabled={step.isPassword}
                size="small"
                sx={{
                  width: '100%',
                  marginTop: '4px',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '18px', // Rounded border
                  },
                }}
              />
            </div>
          </div>
        );
      case "SCROLL":
        const currentDeltaY = getValue(index, 'deltaY', String(step.deltaY ?? 0));
        return (
          <div key={index} className="step-item step-item-type">
              <div className="step-content">
              <div className="step-checkbox">
                <Checkbox defaultChecked />
                <div className="step-number">Step: {stepNumber}</div>
              </div>
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

            <div className="step-content">
            <div className="step-number">Step: {stepNumber}</div>
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
            <div className="step-content">
            <div className="step-number">Step: {stepNumber}</div>
              <div className="step-title">NAVIGATE</div>
              <TextField
                id={`navigate-field-${index}`}
                value={currentUrl}
                onChange={(e) => handleValueChange(index, 'url', e.target.value)}
                label=""
                size="small"
                sx={{
                  width: '100%',
                  marginTop: '4px',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '18px', // Rounded border
                  },
                }}
                InputProps={{
                  readOnly: true, // Make the field uneditable
                }}
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
          <div className="step-number">Step: {stepNumber}</div>
          <div className="step-content">
            <div className="step-title">{action.TYPE.label || 'Input'}</div>
            <TextField
              id={`type-field-${index}`}
              value={currentText}
              onChange={(e) => handleValueChange(index, 'text', e.target.value)}
              disabled={action.TYPE.isPassword}
              size="small"
              sx={{
                width: '100%',
                marginTop: '4px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '18px', // Rounded border
                },
              }}
            />
          </div>
        </div>
      );
    }
    
    if ("CLICK" in action) {
      return (
        <div key={index} className="step-item step-item-click">
          <div className="step-checkbox">
            <Checkbox defaultChecked disabled/>
          </div>
          <div className="step-number">Step: {stepNumber}</div>
          <div className="step-content step-content-click ">
            <div className="step-type-label step-content-click-info">
              CLICK
            <InfoIcon className="step-info-icon" />
            </div>
            <div className="step-click-icons">
              <AdsClickIcon className="step-click-icon" />
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
          <div className="step-number">Step: {stepNumber}</div>
          <div className="step-content">
            <div className="step-title">SCROLL</div>
            <TextField
              id={`scroll-field-${index}`}
              value={currentDeltaY}
              onChange={(e) => handleValueChange(index, 'deltaY', e.target.value)}
              label="Delta Y"
              size="small"
              type="number"
              sx={{
                width: '100%',
                marginTop: '4px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '18px', // Rounded border
                },
              }}
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
          <div className="step-number">Step: {stepNumber}</div>
          <div className="step-content">
            <div className="step-title">WAIT</div>
            <TextField
              id={`wait-field-${index}`}
              value={currentWait}
              onChange={(e) => handleValueChange(index, 'wait', e.target.value)}
              label="Duration (ms)"
              size="small"
              type="number"
              sx={{
                width: '100%',
                marginTop: '4px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '18px', // Rounded border
                },
              }}
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
          <div className="step-number">Step: {stepNumber}</div>
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

  // Determine which steps to display (current tab only if tabbed steps are available)
  const hasLoadedSteps = loadedSteps.length > 0;
  const hasLoadedStepsByTab = Object.keys(loadedStepsByTab).length > 0;
  const hasSteps = steps && steps.length > 0;
  const currentSteps: Step[] = hasLoadedStepsByTab
    ? (loadedStepsByTab[selectedTabId] || [])
    : loadedSteps;

  const handleTabChange = (value: string) => {
    setSelectedTabId(value);
    if (setActiveTabId) setActiveTabId(value);
    // Reset local edit caches when switching tabs
    setEditedValues({});
    setDirtyFields({});
    // Refetch steps for the newly selected tab
    (async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        await fetchSteps();
      } finally {
        isFetchingRef.current = false;
      }
    })();
  };

  return (
    <div className="steps-panel">
      <div className="steps-panel-content">
        <a className="tools-header-tag">STEPS</a>
        {tabs && tabs.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="steps-tab-select">Tab</InputLabel>
              <Select
                labelId="steps-tab-select"
                label="Tab"
                value={selectedTabId || ""}
                onChange={(e) => handleTabChange(e.target.value as string)}
              >
                {tabs.map(t => (
                  <MenuItem key={t.id} value={t.id}>{t.title || t.id}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        )}
        {loading ? (
          <div className="steps-panel-empty">
            <p>Loading steps...</p>
          </div>
        ) : (hasLoadedSteps || hasLoadedStepsByTab) ? (
          <>
            <h3 className="steps-panel-section-title">
              {tabs && tabs.length > 0
                ? `${(tabs.find(t => t.id === selectedTabId)?.title || selectedTabId)} (${currentSteps.length})`
                : `Steps (${currentSteps.length})`}
            </h3>
            <div className="steps-list">
              {currentSteps.map((step, index) => renderStep(step, index))}
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
        <Box
           sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px', // Adjust spacing as needed
            gap: '8px', // Add spacing between buttons
          }}
        >
          <Button
            variant="contained"
            sx={{
              borderRadius: '18px', // Rounded button
              marginRight: '8px', // Spacing between buttons
              flexGrow: 1, // Make button take available space
            }}
          >
            Run Steps
          </Button>
          <Button
            variant="outlined"
            sx={{
              borderRadius: '18px', // Rounded button
              flex: 1, // Make button take available space
            }}
          >
            Let AI Execute
          </Button>
        </Box>
      </div>
    </div>
  );
}

export default StepsPanel;

