import type { Action, Step, TabData } from "../../types";
import './StepsPanel.css';
import TextField from '@mui/material/TextField';
import { PlayArrow as PlayIcon, Star as RequiredIcon, ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { SyntheticEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRef } from 'react';
import { runPixel } from "@semoss/sdk";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Typography,
  Chip,
  Switch
} from "@mui/material";

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
  const [editedValues, setEditedValues] = useState<Record<string, Record<number, { [key: string]: string }>>>({});
  const [loadedSteps, setLoadedSteps] = useState<Step[]>([]);
  const [loadedStepsByTab, setLoadedStepsByTab] = useState<Record<string, Step[]>>({});
  const [loading, setLoading] = useState(false);
  const [dirtyFields, setDirtyFields] = useState<Record<string, Record<number, Set<string>>>>({});
  const [selectedSteps, setSelectedSteps] = useState<Record<string, Set<number>>>({});
  const isFetchingRef = useRef(false);
  const defaultTabKey = "__default__";
  const [expandedTabIds, setExpandedTabIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const initialId = activeTabId || tabs?.[0]?.id;
    initial.add(initialId ?? defaultTabKey);
    return initial;
  });

  // Keep accordion expansion in sync with external activeTabId (screen tabs)
  useEffect(() => {
    if (!activeTabId) return;
    setExpandedTabIds(prev => {
      if (prev.has(activeTabId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(activeTabId);
      return next;
    });
  }, [activeTabId]);

  const ensureTabKey = useCallback(
    (tabId?: string) => (tabId && tabId.length > 0 ? tabId : defaultTabKey),
    [defaultTabKey]
  );

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
      // const output = pixelReturn?.output;
      const output = pixelReturn?.output as { steps?: Record<string, any> } | undefined;
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

  // Initialize selected steps when steps are loaded (default all selected)
  useEffect(() => {
    const hasTabs = Object.keys(loadedStepsByTab).length > 0;
    const tabsToProcess = hasTabs
      ? loadedStepsByTab
      : { [defaultTabKey]: loadedSteps };

    setSelectedSteps(prev => {
      const next = { ...prev };
      Object.entries(tabsToProcess).forEach(([tabKey, tabSteps]) => {
        if (!next[tabKey] && tabSteps && tabSteps.length > 0) {
          // Initialize all steps as selected by default
          next[tabKey] = new Set(tabSteps.map((_, index) => index));
        }
      });
      return next;
    });
  }, [loadedSteps, loadedStepsByTab, defaultTabKey]);

  // Seed editedValues from currently displayed steps without overwriting fields user is actively editing
  useEffect(() => {
    const hasTabs = Object.keys(loadedStepsByTab).length > 0;
    const tabsToProcess = hasTabs
      ? loadedStepsByTab
      : { [defaultTabKey]: loadedSteps };

    setEditedValues(prev => {
      let updated = false;
      const next: typeof prev = { ...prev };

      Object.entries(tabsToProcess).forEach(([tabKey, tabSteps]) => {
        if (!tabSteps || tabSteps.length === 0) return;
        const tabDirty = dirtyFields[tabKey] || {};
        const tabValues = { ...(next[tabKey] || {}) };

        tabSteps.forEach((step, index) => {
          const dirty = tabDirty[index] || new Set<string>();
          if (step.type === 'TYPE' && !dirty.has('text')) {
            const value = step.isPassword ? '••••••••' : step.text;
            const existing = tabValues[index] || {};
            if (existing.text !== value) {
              tabValues[index] = { ...existing, text: value };
              updated = true;
            }
          } else if (step.type === 'SCROLL' && !dirty.has('deltaY')) {
            const value = String(step.deltaY ?? 0);
            const existing = tabValues[index] || {};
            if (existing.deltaY !== value) {
              tabValues[index] = { ...existing, deltaY: value };
              updated = true;
            }
          } else if (step.type === 'WAIT' && !dirty.has('wait')) {
            const value = String(step.waitAfterMs ?? 0);
            const existing = tabValues[index] || {};
            if (existing.wait !== value) {
              tabValues[index] = { ...existing, wait: value };
              updated = true;
            }
          } else if (step.type === 'NAVIGATE' && !dirty.has('url')) {
            const value = step.url;
            const existing = tabValues[index] || {};
            if (existing.url !== value) {
              tabValues[index] = { ...existing, url: value };
              updated = true;
            }
          }
        });

        if (Object.keys(tabValues).length > 0) {
          next[tabKey] = tabValues;
        }
      });

      return updated ? next : prev;
    });
  }, [loadedSteps, loadedStepsByTab, dirtyFields, defaultTabKey]);

  const handleValueChange = (tabId: string, index: number, field: string, value: string) => {
    const tabKey = ensureTabKey(tabId);

    setEditedValues(prev => {
      const next = { ...prev };
      const tabValues = { ...(next[tabKey] || {}) };
      const fieldValues = { ...(tabValues[index] || {}) };

      if (fieldValues[field] === value) {
        return prev;
      }

      fieldValues[field] = value;
      tabValues[index] = fieldValues;
      next[tabKey] = tabValues;

      return next;
    });

    setDirtyFields(prev => {
      const next = { ...prev };
      const tabDirty = { ...(next[tabKey] || {}) };
      const existing = tabDirty[index] ? new Set(Array.from(tabDirty[index])) : new Set<string>();
      existing.add(field);
      tabDirty[index] = existing;
      next[tabKey] = tabDirty;
      return next;
    });

    // Broadcast to overlay that panel value changed (for TYPE text or other fields)
    try {
      const hasTabs = Object.keys(loadedStepsByTab).length > 0;
      const current = hasTabs
        ? (loadedStepsByTab[tabKey] || [])
        : loadedSteps;
      const step = current[index];
      if (field === 'text' && step && step.type === 'TYPE') {
        const label = step.label ?? null;
        window.dispatchEvent(new CustomEvent('stepTextDraftFromPanel', {
          detail: { label, text: value }
        }));
      }
    } catch {}

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

  // Listen for overlay-driven text changes to keep panel in sync
  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ label: string | null; text: string }>;
      const incoming = ce.detail;
      if (!incoming) return;

      const hasTabs = Object.keys(loadedStepsByTab).length > 0;
      const tabsToProcess = hasTabs
        ? loadedStepsByTab
        : { [defaultTabKey]: loadedSteps };

      for (const [tabKey, tabSteps] of Object.entries(tabsToProcess)) {
        const targetIndex = tabSteps.findIndex(s => {
          if (s.type !== 'TYPE') return false;
          const lbl = s.label ?? null;
          return incoming.label == null || lbl == null || lbl === incoming.label;
        });
        if (targetIndex >= 0) {
          setEditedValues(prev => {
            const next = { ...prev };
            const tabValues = { ...(next[tabKey] || {}) };
            tabValues[targetIndex] = { ...(tabValues[targetIndex] || {}), text: incoming.text };
            next[tabKey] = tabValues;
            return next;
          });
          break;
        }
      }
    };
    window.addEventListener('stepTextDraftFromOverlay', handler as EventListener);
    return () => window.removeEventListener('stepTextDraftFromOverlay', handler as EventListener);
  }, [loadedSteps, loadedStepsByTab, defaultTabKey]);

  const getValue = (tabId: string, index: number, field: string, defaultValue: string) => {
    const tabKey = ensureTabKey(tabId);
    return editedValues[tabKey]?.[index]?.[field] ?? defaultValue;
  };

  const handleStepSelection = (tabId: string, index: number, checked: boolean) => {
    const tabKey = ensureTabKey(tabId);
    setSelectedSteps(prev => {
      const next = { ...prev };
      const tabSelections = new Set(next[tabKey] || []);
      if (checked) {
        tabSelections.add(index);
      } else {
        tabSelections.delete(index);
      }
      next[tabKey] = tabSelections;
      return next;
    });
  };

  const isStepSelected = (tabId: string, index: number): boolean => {
    const tabKey = ensureTabKey(tabId);
    return selectedSteps[tabKey]?.has(index) ?? true; // Default to selected
  };

  const renderStep = (tabId: string, step: Step, index: number) => {
    const tabKey = ensureTabKey(tabId);
    const stepNumber = index + 1;
    const isSelected = isStepSelected(tabKey, index);
    
    // Determine if step is required (for TYPE steps, check if label exists or storeValue is true)
    const isRequired = step.type === "TYPE" && (step.label || step.storeValue);
    
    switch (step.type) {
      case "CLICK":
        return (
          <div key={index} className="step-item step-item-click">
            <div className="step-toggle step-toggle-absolute">
              <Switch 
                checked={isSelected} 
                onChange={(e) => handleStepSelection(tabKey, index, e.target.checked)}
                disabled 
              />
            </div>
            <div className="step-content step-content-full">
              {/* Row 1: Play icon - Step number - Required icon */}
              <div className="step-row-1">
                <PlayIcon className="play-icon" />
                <span className="step-number-text">Step {stepNumber}</span>
                {isRequired && <RequiredIcon className="required-icon" />}
              </div>
              {/* Row 2: Label at left, stored tag at right */}
              <div className="step-row-2">
                <span className="step-label">CLICK</span>
              </div>
              {/* Row 3: Full width (empty for CLICK) */}
            </div>
          </div>
        );
      case "TYPE": {
        const currentText = getValue(tabKey, index, 'text', step.isPassword ? "••••••••" : step.text);
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-toggle step-toggle-absolute">
              <Switch 
                checked={isSelected}
                onChange={(e) => handleStepSelection(tabKey, index, e.target.checked)}
              />
            </div>
            <div className="step-content step-content-full">
              {/* Row 1: Play icon - Step number - Required icon */}
              <div className="step-row-1">
                <PlayIcon className="play-icon" />
                <span className="step-number-text">Step {stepNumber}</span>
                {isRequired && <RequiredIcon className="required-icon" />}
              </div>
              {/* Row 2: Label at left, stored tag at right */}
              <div className="step-row-2">
                <span className="step-label">{step.label || 'Input'}</span>
                {step.storeValue && (
                  <Chip label="Stored" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                )}
              </div>
              {/* Row 3: Full width text field */}
              <TextField
                id={`type-field-${tabKey}-${index}`}
                value={currentText}
                onChange={(e) => handleValueChange(tabKey, index, 'text', e.target.value)}
                disabled={step.isPassword}
                size="small"
                fullWidth
                className="step-text-field-rounded"
              />
            </div>
          </div>
        );
      }
      case "SCROLL": {
        const currentDeltaY = getValue(tabKey, index, 'deltaY', String(step.deltaY ?? 0));
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-toggle step-toggle-absolute">
              <Switch 
                checked={isSelected}
                onChange={(e) => handleStepSelection(tabKey, index, e.target.checked)}
              />
            </div>
            <div className="step-content step-content-full">
              {/* Row 1: Play icon - Step number - Required icon */}
              <div className="step-row-1">
                <PlayIcon className="play-icon" />
                <span className="step-number-text">Step {stepNumber}</span>
                {isRequired && <RequiredIcon className="required-icon" />}
              </div>
              {/* Row 2: Label at left, stored tag at right */}
              <div className="step-row-2">
                <span className="step-label">SCROLL</span>
              </div>
              {/* Row 3: Full width text field */}
              <TextField
                id={`scroll-field-${tabKey}-${index}`}
                value={currentDeltaY}
                onChange={(e) => handleValueChange(tabKey, index, 'deltaY', e.target.value)}
                label="Delta Y"
                size="small"
                type="number"
                fullWidth
              />
            </div>
          </div>
        );
      }
      case "WAIT": {
        const currentWait = getValue(tabKey, index, 'wait', String(step.waitAfterMs ?? 0));
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-toggle step-toggle-absolute">
              <Switch 
                checked={isSelected}
                onChange={(e) => handleStepSelection(tabKey, index, e.target.checked)}
              />
            </div>
            <div className="step-content step-content-full">
              {/* Row 1: Play icon - Step number - Required icon */}
              <div className="step-row-1">
                <PlayIcon className="play-icon" />
                <span className="step-number-text">Step {stepNumber}</span>
                {isRequired && <RequiredIcon className="required-icon" />}
              </div>
              {/* Row 2: Label at left, stored tag at right */}
              <div className="step-row-2">
                <span className="step-label">WAIT</span>
              </div>
              {/* Row 3: Full width text field */}
              <TextField
                id={`wait-field-${tabKey}-${index}`}
                value={currentWait}
                onChange={(e) => handleValueChange(tabKey, index, 'wait', e.target.value)}
                label="Duration (ms)"
                size="small"
                type="number"
                fullWidth
              />
            </div>
          </div>
        );
      }
      case "NAVIGATE": {
        const currentUrl = getValue(tabKey, index, 'url', step.url);
        return (
          <div key={index} className="step-item step-item-type">
            <div className="step-toggle step-toggle-absolute">
              <Switch 
                checked={isSelected}
                onChange={(e) => handleStepSelection(tabKey, index, e.target.checked)}
              />
            </div>
            <div className="step-content step-content-full">
              {/* Row 1: Play icon - Step number - Required icon */}
              <div className="step-row-1">
                <PlayIcon className="play-icon" />
                <span className="step-number-text">Step {stepNumber}</span>
                {isRequired && <RequiredIcon className="required-icon" />}
              </div>
              {/* Row 2: Label at left, stored tag at right */}
              <div className="step-row-2">
                <span className="step-label">NAVIGATE</span>
              </div>
              {/* Row 3: Full width text field */}
              <TextField
                id={`navigate-field-${tabKey}-${index}`}
                value={currentUrl}
                onChange={(e) => handleValueChange(tabKey, index, 'url', e.target.value)}
                label="URL"
                size="small"
                fullWidth
                className="step-text-field-rounded"
                InputProps={{
                  readOnly: true,
                }}
              />
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  // const renderAction = (action: Action, index: number) => {
  //   const stepNumber = index + 1;
    
  //   if ("TYPE" in action) {
  //     const currentText = getValue(index, 'text', action.TYPE.isPassword ? "••••••••" : action.TYPE.text);
      
  //     return (
  //       <div key={index} className="step-item step-item-type">
  //         <div className="step-toggle">
  //           <Switch defaultChecked />
  //         </div>
  //         <div className="step-number">Step: {stepNumber}</div>
  //         <div className="step-content">
  //           <div className="step-title">{action.TYPE.label || 'Input'}</div>
  //           <TextField
  //             id={`type-field-${index}`}
  //             value={currentText}
  //             onChange={(e) => handleValueChange(index, 'text', e.target.value)}
  //             disabled={action.TYPE.isPassword}
  //             size="small"
  //             sx={{
  //               width: '100%',
  //               marginTop: '4px',
  //               '& .MuiOutlinedInput-root': {
  //                 borderRadius: '18px', // Rounded border
  //               },
  //             }}
  //           />
  //         </div>
  //       </div>
  //     );
  //   }
    
  //   if ("CLICK" in action) {
  //     return (
  //       <div key={index} className="step-item step-item-click">
  //         <div className="step-toggle">
  //           <Switch defaultChecked disabled/>
  //         </div>
  //         <div className="step-number">Step: {stepNumber}</div>
  //         <div className="step-content step-content-click ">
  //           <div className="step-type-label step-content-click-info">
  //             CLICK
  //           <InfoIcon className="step-info-icon" />
  //           </div>
  //           <div className="step-click-icons">
  //             <AdsClickIcon className="step-click-icon" />
  //           </div>
  //         </div>
  //       </div>
  //     );
  //   }
    
  //   if ("SCROLL" in action) {
  //     const currentDeltaY = getValue(index, 'deltaY', String(action.SCROLL.deltaY));
      
  //     return (
  //       <div key={index} className="step-item step-item-type">
  //         <div className="step-toggle">
  //           <Switch defaultChecked />
  //         </div>
  //         <div className="step-number">Step: {stepNumber}</div>
  //         <div className="step-content">
  //           <div className="step-title">SCROLL</div>
  //           <TextField
  //             id={`scroll-field-${index}`}
  //             value={currentDeltaY}
  //             onChange={(e) => handleValueChange(index, 'deltaY', e.target.value)}
  //             label="Delta Y"
  //             size="small"
  //             type="number"
  //             sx={{
  //               width: '100%',
  //               marginTop: '4px',
  //               '& .MuiOutlinedInput-root': {
  //                 borderRadius: '18px', // Rounded border
  //               },
  //             }}
  //           />
  //         </div>
  //       </div>
  //     );
  //   }
    
  //   if ("WAIT" in action) {
  //     const currentWait = getValue(index, 'wait', String(action.WAIT));
      
  //     return (
  //       <div key={index} className="step-item step-item-type">
  //         <div className="step-toggle">
  //           <Switch defaultChecked />
  //         </div>
  //         <div className="step-number">Step: {stepNumber}</div>
  //         <div className="step-content">
  //           <div className="step-title">WAIT</div>
  //           <TextField
  //             id={`wait-field-${index}`}
  //             value={currentWait}
  //             onChange={(e) => handleValueChange(index, 'wait', e.target.value)}
  //             label="Duration (ms)"
  //             size="small"
  //             type="number"
  //             sx={{
  //               width: '100%',
  //               marginTop: '4px',
  //               '& .MuiOutlinedInput-root': {
  //                 borderRadius: '18px', // Rounded border
  //               },
  //             }}
  //           />
  //         </div>
  //       </div>
  //     );
  //   }
    
  //   if ("NAVIGATE" in action) {
  //     const currentUrl = getValue(index, 'url', action.NAVIGATE);
      
  //     return (
  //       <div key={index} className="step-item step-item-type">
  //         <div className="step-toggle">
  //           <Switch defaultChecked />
  //         </div>
  //         <div className="step-number">Step: {stepNumber}</div>
  //         <div className="step-content">
  //           <div className="step-title">NAVIGATE</div>
  //           <TextField
  //             id={`navigate-field-${index}`}
  //             value={currentUrl}
  //             onChange={(e) => handleValueChange(index, 'url', e.target.value)}
  //             label="URL"
  //             size="small"
  //             sx={{ width: '100%', marginTop: '4px' }}
  //           />
  //         </div>
  //       </div>
  //     );
  //   }
    
  //   return null;
  // };

  // Determine which steps to display
  const hasLoadedSteps = loadedSteps.length > 0;
  const hasLoadedStepsByTab = Object.keys(loadedStepsByTab).length > 0;
  const hasSteps = steps && steps.length > 0;
  const hasEditedActions = editedData && editedData.length > 0;
  const stepsByTabForRender: Record<string, Step[]> = hasLoadedStepsByTab
    ? loadedStepsByTab
    : { [defaultTabKey]: loadedSteps };

  const handleAccordionToggle = (tabId: string, externalId?: string) => (_: SyntheticEvent, expanded: boolean) => {
    setExpandedTabIds(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(tabId);
        if (setActiveTabId && externalId) setActiveTabId(externalId);
      } else {
        next.delete(tabId);
      }
      return next;
    });
  };

  const handleRunSelectedSteps = async (tabId: string) => {
    const tabKey = ensureTabKey(tabId);
    const hasLoadedStepsByTab = Object.keys(loadedStepsByTab).length > 0;
    const stepsByTabForRender: Record<string, Step[]> = hasLoadedStepsByTab
      ? loadedStepsByTab
      : { [defaultTabKey]: loadedSteps };
    const tabSteps = stepsByTabForRender[tabKey] || [];
    const selectedIndices = selectedSteps[tabKey] || new Set<number>();
    
    if (selectedIndices.size === 0) {
      alert("Please select at least one step to run");
      return;
    }

    if (!sessionId || !selectedRecording) {
      alert("Session or recording not available");
      return;
    }

    setLoading(true);
    try {
      const stepsToRun = Array.from(selectedIndices)
        .sort((a: number, b: number) => a - b)
        .map((index: number) => ({ step: tabSteps[index], originalIndex: index }))
        .filter((item: { step: Step | undefined; originalIndex: number }) => item.step);

      for (let i = 0; i < stepsToRun.length; i++) {
        const { step, originalIndex } = stepsToRun[i];
        let pixel: string;

        if (step.type === "TYPE" && step.label) {
          const tabKeyForValue = ensureTabKey(tabId);
          const textValue = editedValues[tabKeyForValue]?.[originalIndex]?.text ?? step.text;
          const stepParamValues = { [step.label]: textValue };
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${tabId}", paramValues=[${JSON.stringify(stepParamValues)}], executeAll=false);`;
        } else {
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${tabId}", executeAll=false);`;
        }

        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0] as any;
        
        if (output?.screenshot) {
          window.dispatchEvent(new CustomEvent('stepsExecuted', { detail: { screenshot: output.screenshot } }));
        }
      }

      alert(`Successfully executed ${stepsToRun.length} selected step(s)`);
      await fetchSteps();
    } catch (err) {
      console.error("Error running selected steps:", err);
      alert("Error running selected steps: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLetAIExecute = async (tabId: string) => {
    const tabKey = ensureTabKey(tabId);
    const hasLoadedStepsByTab = Object.keys(loadedStepsByTab).length > 0;
    const stepsByTabForRender: Record<string, Step[]> = hasLoadedStepsByTab
      ? loadedStepsByTab
      : { [defaultTabKey]: loadedSteps };
    const tabSteps = stepsByTabForRender[tabKey] || [];
    const selectedIndices = selectedSteps[tabKey] || new Set<number>();
    
    if (selectedIndices.size === 0) {
      alert("Please select at least one step for AI execution");
      return;
    }

    if (!sessionId) {
      alert("Session not available");
      return;
    }

    setLoading(true);
    try {
      const stepsToExecute = Array.from(selectedIndices)
        .sort((a: number, b: number) => a - b)
        .map((index: number) => ({ step: tabSteps[index], originalIndex: index }))
        .filter((item: { step: Step | undefined; originalIndex: number }) => item.step);

      const stepsDescription = stepsToExecute.map((item, idx) => {
        const step = item.step;
        switch (step.type) {
          case "CLICK":
            return `${idx + 1}. Click at coordinates (${step.coords.x}, ${step.coords.y})`;
          case "TYPE":
            return `${idx + 1}. Type "${step.text}" into ${step.label || 'input field'}`;
          case "SCROLL":
            return `${idx + 1}. Scroll by ${step.deltaY || 0} pixels`;
          case "WAIT":
            return `${idx + 1}. Wait for ${step.waitAfterMs || 0}ms`;
          case "NAVIGATE":
            return `${idx + 1}. Navigate to ${step.url}`;
          default:
            return `${idx + 1}. Execute step`;
        }
      }).join("\n");

      const userPrompt = window.prompt(
        `AI will execute the following steps:\n\n${stepsDescription}\n\nProvide additional context (optional):`,
        ""
      );

      if (userPrompt === null) {
        setLoading(false);
        return;
      }

      for (let i = 0; i < stepsToExecute.length; i++) {
        const { step, originalIndex } = stepsToExecute[i];
        let pixel: string;

        if (step.type === "TYPE" && step.label && selectedRecording) {
          const tabKeyForValue = ensureTabKey(tabId);
          const textValue = editedValues[tabKeyForValue]?.[originalIndex]?.text ?? step.text;
          const stepParamValues = { [step.label]: textValue };
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${tabId}", paramValues=[${JSON.stringify(stepParamValues)}], executeAll=false);`;
        } else if (selectedRecording) {
          pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${tabId}", executeAll=false);`;
        } else {
          continue;
        }

        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0] as any;
        
        if (output?.screenshot) {
          window.dispatchEvent(new CustomEvent('stepsExecuted', { detail: { screenshot: output.screenshot } }));
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      alert(`AI executed ${stepsToExecute.length} step(s)`);
      await fetchSteps();
    } catch (err) {
      console.error("Error in AI execution:", err);
      alert("Error in AI execution: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const renderButtons = (tabId: string) => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        gap: '8px',
      }}
    >
      <Button
        variant="contained"
        onClick={() => handleRunSelectedSteps(tabId)}
        disabled={loading}
        sx={{
          borderRadius: '18px',
          marginRight: '8px',
          flexGrow: 1,
        }}
      >
        Run Selected Steps
      </Button>
      <Button
        variant="outlined"
        onClick={() => handleLetAIExecute(tabId)}
        disabled={loading}
        sx={{
          borderRadius: '18px',
          flex: 1,
        }}
      >
        Let AI Execute
      </Button>
    </Box>
  );

  const renderTabsAccordion = () => (
    <div className="steps-tab-accordion-group">
      {tabs?.map(tab => {
        const tabKey = ensureTabKey(tab.id);
        const tabSteps = stepsByTabForRender[tabKey] || [];
        const isExpanded = expandedTabIds.has(tabKey);
        const allStepsSelected = tabSteps.length > 0 && 
          (selectedSteps[tabKey]?.size ?? 0) === tabSteps.length;

        return (
          <Accordion
            key={tabKey}
            expanded={isExpanded}
            onChange={handleAccordionToggle(tabKey, tab.id)}
            disableGutters
            className="steps-accordion"
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box className="accordion-summary-container">
                <Box
                  className={`accordion-indicator-line ${isExpanded ? 'accordion-indicator-line-expanded' : 'accordion-indicator-line-collapsed'}`}
                />
                <Typography 
                  variant="subtitle2" 
                  fontWeight={600}
                  className="accordion-title-right"
                >
                  {tab.title || tab.id} ({tabSteps.length})
                </Typography>
                {/* <Switch
                  checked={allStepsSelected}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedSteps(prev => {
                      const next = { ...prev };
                      if (checked) {
                        next[tabKey] = new Set(tabSteps.map((_, idx) => idx));
                      } else {
                        next[tabKey] = new Set();
                      }
                      return next;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="accordion-checkbox"
                /> */}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {tabSteps.length > 0 ? (
                <div className="steps-list">
                  {tabSteps.map((step, index) => renderStep(tabKey, step, index))}
                </div>
              ) : (
                <div className="steps-panel-empty">
                  <p>No steps available for this tab</p>
                </div>
              )}
              {renderButtons(tab.id)}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </div>
  );

  const defaultSteps = hasLoadedSteps
    ? loadedSteps
    : hasSteps
      ? steps
      : [];
  const hasDefaultSteps = defaultSteps.length > 0;
  const showEditedActions = !hasDefaultSteps && hasEditedActions;

  const renderSingleAccordion = () => {
    const isExpanded = expandedTabIds.has(defaultTabKey);
    const allStepsSelected = defaultSteps.length > 0 && 
      (selectedSteps[defaultTabKey]?.size ?? 0) === defaultSteps.length;

    return (
      <>
        {(hasDefaultSteps || showEditedActions) ? (
          <Accordion
            expanded={isExpanded}
            onChange={handleAccordionToggle(defaultTabKey)}
            disableGutters
            className="steps-accordion"
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box className="accordion-summary-container">
                <Box
                  className={`accordion-indicator-line ${isExpanded ? 'accordion-indicator-line-expanded' : 'accordion-indicator-line-collapsed'}`}
                />
                <Typography 
                  variant="subtitle2" 
                  fontWeight={600}
                  className="accordion-title-right"
                >
                  Steps ({(hasDefaultSteps ? defaultSteps.length : editedData.length)})
                </Typography>
                <Switch
                  checked={allStepsSelected}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedSteps(prev => {
                      const next = { ...prev };
                      if (checked) {
                        next[defaultTabKey] = new Set(defaultSteps.map((_, idx) => idx));
                      } else {
                        next[defaultTabKey] = new Set();
                      }
                      return next;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="accordion-checkbox"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {hasDefaultSteps ? (
                <div className="steps-list">
                  {defaultSteps.map((step, index) => renderStep(defaultTabKey, step, index))}
                </div>
              ) : (
                <div className="steps-list">
                  {editedData.map((action, index) => {
                    // Convert Action to Step for rendering if needed
                    return null; // Placeholder - you may need to implement renderAction
                  })}
                </div>
              )}
              {renderButtons(defaultTabKey)}
            </AccordionDetails>
          </Accordion>
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
      </>
    );
  };

  return (
    <div className="steps-panel">
      <div className="steps-panel-content">
        <a className="tools-header-tag">STEPS</a>
        {loading ? (
          <div className="steps-panel-empty">
            <p>Loading steps...</p>
          </div>
        ) : tabs && tabs.length > 0 ? (
          renderTabsAccordion()
        ) : (
          renderSingleAccordion()
        )}
      </div>
    </div>
  );
}

export default StepsPanel;

