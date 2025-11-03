import {
    Mouse as MouseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    AccessTime as AccessTimeIcon,
    Sync as SyncIcon,
    CropFree as CropIcon,
    List as ListIcon,
    OpenInFull as ExpandIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
  } from "@mui/icons-material";
import { type JSX, useState, useRef, useEffect } from "react";
import type { Step, Viewport } from "../../types";
import {useSendStep} from"../../hooks/useSendStep"
import './toolbar.css';
import { fetchScreenshot } from '../../hooks/useFetchScreenshot';
import { useSessionStore } from "../../store/useSessionStore";

import ExpandedInputs from '../ExpandedInputs/ExpandedInputs'; 
function Toolbar() {
  const {
    sessionId,
    insightId,
    shot,
    setShot,
    mode,
    setMode,
    activeTabId,
    selectedModel
  , tabs, setTabs} = useSessionStore();
  const [showInputsMenu, setShowInputsMenu] = useState(false);
  const [showExpandedView, setShowExpandedView] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState<{tabId: string; stepIndex: number} | null>(null);
  const [editedLabel, setEditedLabel] = useState<string>("");
  const [editedValue, setEditedValue] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editedSteps, setEditedSteps] = useState<Map<string, {tabId: string; stepIndex: number; label: string; text: string; storeValue: boolean; stepId?: number}>>(new Map());
  const [originalSteps, setOriginalSteps] = useState<Map<string, {storeValue: boolean}>>(new Map());
  
  const editingRef = useRef<HTMLDivElement>(null);
  const saveActionsRef = useRef<HTMLDivElement>(null);

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  const { sendStep, updateSteps } = useSendStep();

  // Handle click outside to exit edit mode
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editingInput && editingRef.current && !editingRef.current.contains(event.target as Node)) {
        // Don't exit if clicking on save/cancel buttons
        if (saveActionsRef.current && saveActionsRef.current.contains(event.target as Node)) {
          return;
        }
        // Clicked outside the editing area, exit edit mode without saving
        setEditingInput(null);
      }
    }

    if (editingInput) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [editingInput]);

  async function waitAndShot() {
    if (!sessionId) return;
    const ms = Number(window.prompt("Wait how many ms?", "800")) || 800;
    const step: Step = { type: "WAIT", waitAfterMs: ms, viewport, timestamp: Date.now() };
    await sendStep(step, activeTabId);
  }

  async function scrollUp() {
    if (!shot) return;
    await sendStep({
      type: "SCROLL",
      coords: { x: 0, y: 0 },
      deltaY: -400,
      viewport,
      waitAfterMs: 300,
      timestamp: Date.now(),
    }, activeTabId);
  }

  async function scrollDown() {
    if (!shot) return;
    await sendStep({
      type: "SCROLL",
      coords: { x: 0, y: 0 },
      deltaY: 400,
      viewport,
      waitAfterMs: 300,
      timestamp: Date.now(),
    }, activeTabId);
  }

    // Get total count of all inputs across all tabs
    const getTotalInputsCount = () => {
      let count = 0;
      tabs.forEach(tab => {
        tab.steps.forEach(step => {
          if (step.type === 'TYPE' && step.label) {
            count++;
          }
        });
      });
      return count;
    };

  // Get inputs grouped by tab
  const getInputsByTab = () => {
    return tabs.map(tab => ({
      tabId: tab.id,
      tabTitle: tab.title,
      inputs: tab.steps
        .map((step, stepIndex) => ({ step, stepIndex }))
        .filter(({ step }) => step.type === 'TYPE' && (step as any).label)
        .map(({ step, stepIndex }) => ({
          stepIndex,
          label: (step as any).label!,
          value: (step as any).text,
          storeValue: (step as any).storeValue,
          hasStoreValue: (step as any).storeValue !== undefined,
          isPassword: (step as any).isPassword
        }))
    }));
  };

    const handleEditInput = (tabId: string, stepIndex: number, label: string, value: string) => {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  const step = tab.steps[stepIndex];
  if (!step.id) return;
  setEditingInput({ tabId, stepIndex });
  setEditedLabel(label);
  setEditedValue(value);
    };

    const handleSaveChanges = async () => {
      if (editedSteps.size === 0) return;

      // Convert edited steps map to array for batch update
      const stepsToUpdate = Array.from(editedSteps.values());
      
      // Group by tabId for organized updates
      const stepsByTab = stepsToUpdate.reduce((acc, step) => {
        if (!acc[step.tabId]) acc[step.tabId] = [];
        acc[step.tabId].push(step);
        return acc;
      }, {} as Record<string, typeof stepsToUpdate>);

      // Send batch update to backend using the hook
      try {
        for (const [tabId, steps] of Object.entries(stepsByTab)) {
          const updatePayload = steps.map(step => ({
            id: step.stepId,
            label: step.label,
            text: step.text,
            storeValue: step.storeValue
          }));

          await updateSteps(updatePayload, tabId);
        }
      } catch (error) {
        console.error("Error saving changes:", error);
        // Optionally show error to user
        return;
      }

      // Clear edited steps and reset state
      setEditedSteps(new Map());
      setOriginalSteps(new Map());
      setEditingInput(null);
      setHasUnsavedChanges(false);
    };

    const handleCancelEdit = () => {
      // Revert optimistic UI changes for toggled storeValue
      setTabs(prevTabs => prevTabs.map(tab => {
        return {
          ...tab,
          steps: tab.steps.map((step) => {
            const original = originalSteps.get(step.id?.toString() || "");
            if (step.type === 'TYPE' && original) {
              return {
                ...step,
                storeValue: original.storeValue
              };
            }
            return step;
          })
        };
      }));
      
      // Clear editing state
      setEditedSteps(new Map());
      setOriginalSteps(new Map());
      setEditingInput(null);
      setHasUnsavedChanges(false);
    };

    const handleFieldChange = (field: 'label' | 'text', value: string) => {
      if (!editingInput) return;
      const tab = tabs.find(t => t.id === editingInput.tabId);
      if (!tab) return;
      const step = tab.steps[editingInput.stepIndex];
      if (step.type !== 'TYPE' || !step.id) return;
      // Validation: label must not be empty and must be unique within tab
      let newLabel = field === 'label' ? value : (editedSteps.get(step.id?.toString())?.label ?? editedLabel);
      if (field === 'label') {
        if (!newLabel.trim()) {
          alert('Label cannot be empty.');
          return;
        }
        const duplicate = tab.steps.some((s, idx) => s.type === 'TYPE' && s.label === newLabel && idx !== editingInput.stepIndex);
        if (duplicate) {
          alert('Label must be unique within this tab.');
          return;
        }
      }
      const key = step.id?.toString();
      const existing = editedSteps.get(key);
      const updatedStep = {
        tabId: editingInput.tabId,
        stepIndex: editingInput.stepIndex,
        label: newLabel,
        text: field === 'text' ? value : (existing?.text ?? editedValue),
        storeValue: existing?.storeValue ?? step.storeValue ?? true,
        stepId: step.id
      };
      setEditedSteps(new Map(editedSteps.set(key, updatedStep)));
      setHasUnsavedChanges(true);
      if (field === 'label') setEditedLabel(value);
      if (field === 'text') setEditedValue(value);
    };

    const toggleStoreValue = (tabId: string, stepIndex: number, currentValue: boolean) => {
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return;
      const step = tab.steps[stepIndex];
      if (step.type !== 'TYPE' || !step.id) return;
      const key = step.id.toString();
      const existing = editedSteps.get(key);
      // Save original value if this is the first edit
      if (!originalSteps.has(key)) {
        setOriginalSteps(new Map(originalSteps.set(key, { storeValue: currentValue })));
      }
      const updatedStep = {
        tabId,
        stepIndex,
        label: existing?.label ?? step.label ?? '',
        text: existing?.text ?? step.text,
        storeValue: !currentValue,
        stepId: step.id
      };
      setEditedSteps(new Map(editedSteps.set(key, updatedStep)));
      // Also update local tabs state for immediate UI feedback
      const updatedTabs = tabs.map(t => {
        if (t.id === tabId) {
          return {
            ...t,
            steps: t.steps.map((s) => {
              if (s.id === step.id && s.type === 'TYPE') {
                return {
                  ...s,
                  storeValue: !currentValue
                };
              }
              return s;
            })
          };
        }
        return t;
      });
      setTabs(updatedTabs);
      setHasUnsavedChanges(true);
    };

    const togglePasswordVisibility = (key: string) => {
      setVisiblePasswords(prev => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
        }
        return newSet;
      });
    };

    const isPasswordField = (isPassword?: boolean, label?: string) => {
      return isPassword || (label && label.toLowerCase().includes('password'));
    };

    const maskPassword = (value: string) => {
      return '•'.repeat(value.length);
    };

  return (
    <>
    <div className="toolbar-container">
        {([
          { m: "click", icon: <MouseIcon />, label: "Click" },
          { m: "scroll-up", icon: <ArrowUpIcon />, label: "Scroll Up" },
          { m: "scroll-down", icon: <ArrowDownIcon />, label: "Scroll Down" },
          { m: "delay", icon: <AccessTimeIcon />, label: "Delay" },
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" },
          { m: "crop", icon: <CropIcon />, label: "Add Context" },
          { m: "show-inputs", icon: <ListIcon />, label: "Show Inputs" }

        ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
          const active = mode === m;
          const isModelRequired = m === "crop" || m === "generate-steps";
          const disabled = isModelRequired && !selectedModel;

          const hoverMessage = disabled && m === "crop" ? "Add context: Please add a model to your model catalog to activate" : label;

          return (
            <button
              key={m}
              onClick={async () => {
                if (m === "scroll-up") {
                  scrollUp();
                } else if (m === "scroll-down") {
                  scrollDown();
                } else if (m == "delay") {
                  await waitAndShot();
                } else if (m == "fetch-screenshot") {
                  await fetchScreenshot(sessionId, insightId, activeTabId, setShot);
                } else if (m === "cancel") {
                  setMode("click");
                } else if (m == "crop") {
                  setMode("crop");
                } else if (m === "show-inputs") {
                  const newShowInputsMenu = !showInputsMenu;
                  setShowInputsMenu(newShowInputsMenu);
                  // Auto-select first tab when opening menu
                  if (newShowInputsMenu && !selectedTabId) {
                    const firstTab = getInputsByTab()[0];
                    if (firstTab) {
                      setSelectedTabId(firstTab.tabId);
                    }
                  }
                } else {
                  setMode(m);
                }
              }}
              title={hoverMessage}
              aria-pressed={active}
              disabled={disabled}
              className={`toolbar-button ${active ? "toolbar-button-active" : ""} ${
                disabled ? "toolbar-button-disabled" : ""
              }`}
            >
              {icon}
              {m === "show-inputs" && getTotalInputsCount() > 0 && (
                <span className="toolbar-button-badge">
                  {getTotalInputsCount() > 9 ? '9+' : getTotalInputsCount()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Inputs Menu */}
      {showInputsMenu && (
        <div className="inputs-menu">
          <div className="inputs-menu-header">
            <h3>Stored Inputs</h3>
            <div className="inputs-menu-header-actions">
              <button 
                className="inputs-menu-expand"
                onClick={() => {
                  setShowExpandedView(true);
                  setShowInputsMenu(false);
                }}
                title="Expand view"
              >
                <ExpandIcon fontSize="small" />
              </button>
              <button 
                className="inputs-menu-close"
                onClick={() => setShowInputsMenu(false)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="inputs-menu-content">
            {getInputsByTab().length === 0 ? (
              <p className="inputs-menu-empty">No inputs recorded yet</p>
            ) : (
              <>
                {/* Tab Navigation Bar */}
                <div className="inputs-tabs-nav">
                  {getInputsByTab().map((tab) => (
                    <button
                      key={tab.tabId}
                      className={`inputs-tab-button ${selectedTabId === tab.tabId ? 'active' : ''}`}
                      onClick={() => setSelectedTabId(tab.tabId)}
                    >
                      {tab.tabTitle}
                      <span className="inputs-tab-badge">{tab.inputs.length}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {selectedTabId && getInputsByTab().find(tab => tab.tabId === selectedTabId) && (
                  <div className="inputs-tab-content">
                    {(() => {
                      const selectedTab = getInputsByTab().find(tab => tab.tabId === selectedTabId);
                      if (!selectedTab || selectedTab.inputs.length === 0) {
                        return <p className="inputs-menu-empty">No inputs in this tab</p>;
                      }
                      
                      return selectedTab.inputs.map((input, index) => {
                        const isEditing = editingInput?.tabId === selectedTabId && editingInput?.stepIndex === input.stepIndex;
                        
                        return (
                          <div key={index} className="input-item" ref={isEditing ? editingRef : null}>
                            {isEditing ? (
                              <>
                                <input
                                  className="input-item-edit"
                                  value={editedLabel}
                                  onChange={(e) => handleFieldChange('label', e.target.value)}
                                  placeholder="Label"
                                  autoFocus
                                />
                                {input.isPassword ? (
                                  <div className="input-item-value-readonly" style={{ padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px', color: '#666' }}>
                                    {maskPassword(input.value)} (Password values cannot be edited)
                                  </div>
                                ) : (
                                  <textarea
                                    className="input-item-edit-value"
                                    value={editedValue}
                                    onChange={(e) => handleFieldChange('text', e.target.value)}
                                    placeholder="Value"
                                    rows={2}
                                  />
                                )}
                              </>
                            ) : (
                              <>
                                <div className="input-item-header">
                                  <div 
                                    className="input-item-label editable"
                                    onClick={() => handleEditInput(selectedTabId, input.stepIndex, input.label, input.value)}
                                    title="Click to edit"
                                  >
                                    {input.label}
                                  </div>
                                  {input.hasStoreValue && !isPasswordField(input.isPassword, input.label) && (
                                    <div 
                                      className="store-value-indicator clickable" 
                                      onClick={() => toggleStoreValue(selectedTabId, input.stepIndex, input.storeValue)}
                                      title={input.storeValue ? "Click to mark as not stored" : "Click to mark as stored"}
                                    >
                                      {input.storeValue ? (
                                        <span className="store-value-checked">✓ Stored</span>
                                      ) : (
                                        <span className="store-value-unchecked">✗ Not stored</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="input-value-container">
                                  <div 
                                    className={`input-item-value ${!input.isPassword ? 'editable' : ''}`}
                                    onClick={() => !input.isPassword && handleEditInput(selectedTabId, input.stepIndex, input.label, input.value)}
                                    title={input.isPassword ? "Password values cannot be edited" : "Click to edit"}
                                    style={input.isPassword ? { cursor: 'not-allowed' } : {}}
                                  >
                                    {isPasswordField(input.isPassword, input.label) && !visiblePasswords.has(`${selectedTabId}-${input.stepIndex}`)
                                      ? maskPassword(input.value)
                                      : input.value}
                                  </div>
                                  {isPasswordField(input.isPassword, input.label) && (
                                    <button
                                      className="password-toggle"
                                      onClick={() => togglePasswordVisibility(`${selectedTabId}-${input.stepIndex}`)}
                                      title={visiblePasswords.has(`${selectedTabId}-${input.stepIndex}`) ? "Hide password" : "Show password"}
                                    >
                                      {visiblePasswords.has(`${selectedTabId}-${input.stepIndex}`) 
                                        ? <VisibilityOffIcon fontSize="small" />
                                        : <VisibilityIcon fontSize="small" />
                                      }
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Save Actions - Fixed at bottom */}
          {hasUnsavedChanges && (
            <div className="save-actions" ref={saveActionsRef}>
              <button 
                className="save-button"
                onClick={handleSaveChanges}
              >
                Save
              </button>
              <button 
                className="cancel-button"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expanded Inputs View */}
      {showExpandedView && (
        <ExpandedInputs
          tabs={tabs}
          setTabs={setTabs}
          onClose={() => setShowExpandedView(false)}
        />
      )}
    </>
  )
}

export default Toolbar