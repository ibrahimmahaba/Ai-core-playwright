import {
    Mouse as MouseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    AccessTime as AccessTimeIcon,
    Sync as SyncIcon,
    CropFree as CropIcon,
    List as ListIcon,
  } from "@mui/icons-material";
import { type JSX, useState } from "react";
import type { ToolbarProps, Step, Viewport } from "../../types";
import {useSendStep} from"../../hooks/useSendStep"
import './toolbar.css';
import { fetchScreenshot } from '../../hooks/useFetchScreenshot'; 
function Toolbar(props: ToolbarProps) {
  const { sessionId, insightId, shot, setShot, mode, setMode, setLoading, activeTabId, selectedModel, tabs, setTabs} = props;
  const [showInputsMenu, setShowInputsMenu] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState<{tabId: string; stepIndex: number} | null>(null);
  const [editedLabel, setEditedLabel] = useState<string>("");
  const [editedValue, setEditedValue] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
    const viewport: Viewport = {
        width: shot?.width ?? 1280,
        height: shot?.height ?? 800,
        deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
    };


    const { sendStep } = useSendStep({
      sessionId,
      insightId,
      shot: shot,
      setShot: setShot,
      setLoading: setLoading,
      tabs: props.tabs,
      setTabs: props.setTabs,
      _activeTabId: activeTabId,
      setActiveTabId: props.setActiveTabId
  });

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
        }, activeTabId)
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

    // Get inputs grouped by tab
    const getInputsByTab = () => {
      return tabs.map(tab => ({
        tabId: tab.id,
        tabTitle: tab.title,
        inputs: tab.steps
          .map((step, stepIndex) => ({ step, stepIndex }))
          .filter(({ step }) => step.type === 'TYPE' && step.label)
          .map(({ step, stepIndex }) => ({
            stepIndex,
            label: step.label!,
            value: (step as any).text
          }))
      })).filter(tab => tab.inputs.length > 0);
    };

    const handleEditInput = (tabId: string, stepIndex: number, label: string, value: string) => {
      setEditingInput({ tabId, stepIndex });
      setEditedLabel(label);
      setEditedValue(value);
    };

    const handleSaveChanges = () => {
      if (!editingInput) return;

      const updatedTabs = tabs.map(tab => {
        if (tab.id === editingInput.tabId) {
          return {
            ...tab,
            steps: tab.steps.map((step, idx) => {
              if (idx === editingInput.stepIndex && step.type === 'TYPE') {
                return {
                  ...step,
                  label: editedLabel,
                  text: editedValue
                };
              }
              return step;
            })
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
            </button>
          );
        })}
      </div>

      {/* Inputs Menu */}
      {showInputsMenu && (
        <div className="inputs-menu">
          <div className="inputs-menu-header">
            <h3>Stored Inputs</h3>
            <button 
              className="inputs-menu-close"
              onClick={() => setShowInputsMenu(false)}
            >
              ✕
            </button>
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

                {/* Save Actions */}
                {hasUnsavedChanges && (
                  <div className="save-actions">
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

                {/* Tab Content */}
                {selectedTabId && getInputsByTab().find(tab => tab.tabId === selectedTabId) && (
                  <div className="inputs-tab-content">
                    {getInputsByTab()
                      .find(tab => tab.tabId === selectedTabId)!
                      .inputs.map((input, index) => {
                        const isEditing = editingInput?.tabId === selectedTabId && editingInput?.stepIndex === input.stepIndex;
                        
                        return (
                          <div key={index} className="input-item">
                            {isEditing ? (
                              <>
                                <input
                                  className="input-item-edit"
                                  value={editedLabel}
                                  onChange={(e) => {
                                    setEditedLabel(e.target.value);
                                    setHasUnsavedChanges(true);
                                  }}
                                  placeholder="Label"
                                />
                                <textarea
                                  className="input-item-edit-value"
                                  value={editedValue}
                                  onChange={(e) => {
                                    setEditedValue(e.target.value);
                                    setHasUnsavedChanges(true);
                                  }}
                                  placeholder="Value"
                                  rows={2}
                                />
                              </>
                            ) : (
                              <>
                                <div 
                                  className="input-item-label editable"
                                  onClick={() => handleEditInput(selectedTabId, input.stepIndex, input.label, input.value)}
                                  title="Click to edit"
                                >
                                  {input.label}
                                </div>
                                <div 
                                  className="input-item-value editable"
                                  onClick={() => handleEditInput(selectedTabId, input.stepIndex, input.label, input.value)}
                                  title="Click to edit"
                                >
                                  {input.value}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Toolbar