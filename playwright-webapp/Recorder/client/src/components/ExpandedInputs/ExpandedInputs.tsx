import { useState, useRef, useEffect } from "react";
import type { TabData } from "../../types";
import { Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon } from "@mui/icons-material";
import { useSendStep } from "../../hooks/useSendStep";
import "./ExpandedInputs.css";

interface ExpandedInputsProps {
  tabs: TabData[];
  setTabs: React.Dispatch<React.SetStateAction<TabData[]>>;
  onClose: () => void;
}

function ExpandedInputs({ tabs, setTabs, onClose }: ExpandedInputsProps) {
  const [selectedTabId, setSelectedTabId] = useState<string | null>(
    tabs.length > 0 ? tabs[0].id : null
  );
  const [editingInput, setEditingInput] = useState<{
    tabId: string;
    stepIndex: number;
  } | null>(null);
  const [editedLabel, setEditedLabel] = useState<string>("");
  const [editedValue, setEditedValue] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editedSteps, setEditedSteps] = useState<Map<string, {tabId: string; stepIndex: number; label: string; text: string; storeValue: boolean; stepId?: number}>>(new Map());
  const [originalSteps, setOriginalSteps] = useState<Map<string, {storeValue: boolean}>>(new Map());
  
  const editingRef = useRef<HTMLDivElement>(null);
  const saveActionsRef = useRef<HTMLDivElement>(null);

  const { updateSteps } = useSendStep();

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

  // Get inputs grouped by tab
  const getInputsByTab = () => {
    return tabs.map((tab) => ({
      tabId: tab.id,
      tabTitle: tab.title,
      inputs: tab.steps
        .map((step, stepIndex) => ({ step, stepIndex }))
        .filter(({ step }) => step.type === "TYPE" && step.label)
        .map(({ step, stepIndex }) => ({
          stepIndex,
          label: (step as any).label!,
          value: (step as any).text,
          storeValue: (step as any).storeValue,
          hasStoreValue: (step as any).storeValue !== undefined,
        })),
    }));
  };

  const handleEditInput = (
    tabId: string,
    stepIndex: number,
    label: string,
    value: string
  ) => {
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

  const isPasswordField = (label: string) => {
    return label.toLowerCase().includes('password');
  };

  const maskPassword = (value: string) => {
    return '•'.repeat(value.length);
  };

  return (
    <div className="expanded-inputs-overlay" onClick={onClose}>
      <div className="expanded-inputs-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="expanded-inputs-header">
          <h2>Stored Inputs</h2>
          <button className="expanded-inputs-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="expanded-inputs-body">
          {getInputsByTab().length === 0 ? (
            <p className="expanded-inputs-empty">No inputs recorded yet</p>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="expanded-tabs-nav">
                {getInputsByTab().map((tab) => (
                  <button
                    key={tab.tabId}
                    className={`expanded-tab-button ${
                      selectedTabId === tab.tabId ? "active" : ""
                    }`}
                    onClick={() => setSelectedTabId(tab.tabId)}
                  >
                    {tab.tabTitle}
                    <span className="expanded-tab-badge">{tab.inputs.length}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="expanded-tab-content">
                {selectedTabId &&
                  getInputsByTab().find((tab) => tab.tabId === selectedTabId) && (
                    <>
                      {(() => {
                        const selectedTab = getInputsByTab().find(
                          (tab) => tab.tabId === selectedTabId
                        );
                        if (!selectedTab || selectedTab.inputs.length === 0) {
                          return (
                            <p className="expanded-inputs-empty">
                              No inputs in this tab
                            </p>
                          );
                        }

                        return selectedTab.inputs.map((input, index) => {
                          const isEditing =
                            editingInput?.tabId === selectedTabId &&
                            editingInput?.stepIndex === input.stepIndex;

                          return (
                            <div key={index} className="expanded-input-item" ref={isEditing ? editingRef : null}>
                              {isEditing ? (
                                <>
                                  <input
                                    className="expanded-input-edit"
                                    value={editedLabel}
                                    onChange={(e) => handleFieldChange('label', e.target.value)}
                                    placeholder="Label"
                                    autoFocus
                                  />
                                  <textarea
                                    className="expanded-input-edit-value"
                                    value={editedValue}
                                    onChange={(e) => handleFieldChange('text', e.target.value)}
                                    placeholder="Value"
                                    rows={3}
                                  />
                                </>
                              ) : (
                                <>
                                  <div className="expanded-input-header">
                                    <div
                                      className="expanded-input-label editable"
                                      onClick={() =>
                                        handleEditInput(
                                          selectedTabId,
                                          input.stepIndex,
                                          input.label,
                                          input.value
                                        )
                                      }
                                      title="Click to edit"
                                    >
                                      {input.label}
                                    </div>
                                    {input.hasStoreValue && (
                                      <div 
                                        className="expanded-store-value-indicator clickable" 
                                        onClick={() => toggleStoreValue(selectedTabId, input.stepIndex, input.storeValue)}
                                        title={input.storeValue ? "Click to mark as not stored" : "Click to mark as stored"}
                                      >
                                        {input.storeValue ? (
                                          <span className="expanded-store-value-checked">✓ Stored</span>
                                        ) : (
                                          <span className="expanded-store-value-unchecked">✗ Not stored</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="expanded-value-container">
                                    <div
                                      className="expanded-input-value editable"
                                      onClick={() =>
                                        handleEditInput(
                                          selectedTabId,
                                          input.stepIndex,
                                          input.label,
                                          input.value
                                        )
                                      }
                                      title="Click to edit"
                                    >
                                      {isPasswordField(input.label) && !visiblePasswords.has(`${selectedTabId}-${input.stepIndex}`)
                                        ? maskPassword(input.value)
                                        : input.value}
                                    </div>
                                    {isPasswordField(input.label) && (
                                      <button
                                        className="expanded-password-toggle"
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
                    </>
                  )}
              </div>
            </>
          )}
        </div>

        {/* Save Actions - Fixed at bottom */}
        {hasUnsavedChanges && (
          <div className="expanded-save-actions" ref={saveActionsRef}>
            <button className="expanded-save-button" onClick={handleSaveChanges}>
              Save
            </button>
            <button className="expanded-cancel-button" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExpandedInputs;

