import { useState } from "react";
import type { TabData } from "../../types";
import { Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon } from "@mui/icons-material";
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
          label: step.label!,
          value: (step as any).text,
          storeValue: (step as any).storeValue !== false,
        })),
    }));
  };

  const handleEditInput = (
    tabId: string,
    stepIndex: number,
    label: string,
    value: string
  ) => {
    setEditingInput({ tabId, stepIndex });
    setEditedLabel(label);
    setEditedValue(value);
  };

  const handleSaveChanges = () => {
    if (!editingInput) return;

    const updatedTabs = tabs.map((tab) => {
      if (tab.id === editingInput.tabId) {
        return {
          ...tab,
          steps: tab.steps.map((step, idx) => {
            if (idx === editingInput.stepIndex && step.type === "TYPE") {
              return {
                ...step,
                label: editedLabel,
                text: editedValue,
              };
            }
            return step;
          }),
        };
      }
      return tab;
    });

    setTabs(updatedTabs);
    setEditingInput(null);
    setHasUnsavedChanges(false);
  };

  const handleCancelEdit = () => {
    setEditingInput(null);
    setHasUnsavedChanges(false);
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
                            <div key={index} className="expanded-input-item">
                              {isEditing ? (
                                <>
                                  <input
                                    className="expanded-input-edit"
                                    value={editedLabel}
                                    onChange={(e) => {
                                      setEditedLabel(e.target.value);
                                      setHasUnsavedChanges(true);
                                    }}
                                    placeholder="Label"
                                  />
                                  <textarea
                                    className="expanded-input-edit-value"
                                    value={editedValue}
                                    onChange={(e) => {
                                      setEditedValue(e.target.value);
                                      setHasUnsavedChanges(true);
                                    }}
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
                                    <div className="expanded-store-value-indicator" title={input.storeValue ? "Value is stored" : "Value not stored"}>
                                      {input.storeValue ? (
                                        <span className="expanded-store-value-checked">✓ Stored</span>
                                      ) : (
                                        <span className="expanded-store-value-unchecked">Not stored</span>
                                      )}
                                    </div>
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
          <div className="expanded-save-actions">
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

