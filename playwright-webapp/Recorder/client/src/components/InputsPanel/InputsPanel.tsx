import { useState } from "react";
import type { Step, TabData } from "../../types";
import { useSessionStore } from "../../store/useSessionStore";
import { useSendStep } from "../../hooks/useSendStep";
import './InputsPanel.css';

interface InputsPanelProps {
  tabs: TabData[];
  activeTabId: string;
}

function InputsPanel(props: InputsPanelProps) {
  const { tabs, activeTabId } = props;
  const { setTabs } = useSessionStore();
  const { updateSteps } = useSendStep();
  const [editingInput, setEditingInput] = useState<{tabId: string; stepIndex: number} | null>(null);
  const [editedLabel, setEditedLabel] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");

  // Get all TYPE steps (inputs) from the active tab
  const activeTab = tabs.find(t => t.id === activeTabId);
  const inputSteps = activeTab?.steps
    .map((step, index) => (step.type === 'TYPE' && step.label ? { step, index } : null))
    .filter((item): item is { step: Step; index: number } => item !== null) || [];

  const handleEdit = (tabId: string, stepIndex: number, label: string, text: string) => {
    setEditingInput({ tabId, stepIndex });
    setEditedLabel(label);
    setEditedText(text);
  };

  const handleSave = async () => {
    if (editingInput === null) return;

    const tab = tabs.find(t => t.id === editingInput.tabId);
    if (!tab) return;
    const step = tab.steps[editingInput.stepIndex];
    if (step.type !== 'TYPE' || !step.id) return;

    // Update the step in the tab
    const updatedTabs = tabs.map(t => {
      if (t.id === editingInput.tabId) {
        return {
          ...t,
          steps: t.steps.map((s, idx) => {
            if (idx === editingInput.stepIndex && s.type === 'TYPE') {
              return {
                ...s,
                label: editedLabel,
                text: editedText,
              };
            }
            return s;
          })
        };
      }
      return t;
    });

    setTabs(updatedTabs);

    // Update on backend
    await updateSteps([{
      id: step.id,
      label: editedLabel,
      text: editedText,
      storeValue: step.storeValue
    }], editingInput.tabId);

    setEditingInput(null);
    setEditedLabel("");
    setEditedText("");
  };

  const handleCancel = () => {
    setEditingInput(null);
    setEditedLabel("");
    setEditedText("");
  };

  const maskPassword = (text: string) => {
    return "•".repeat(Math.min(text.length, 20));
  };

  return (
    <div className="inputs-panel">
      <div className="inputs-panel-content">
        <a className="tools-header-tag">INPUTS</a>
        {inputSteps.length > 0 ? (
          <>
            <h3 className="inputs-panel-section-title">Inputs ({inputSteps.length})</h3>
            <div className="inputs-list">
              {inputSteps.map(({ step, index }) => {
                if (step.type !== 'TYPE' || !step.label) return null;
                
                const isEditing = editingInput?.tabId === activeTabId && editingInput?.stepIndex === index;
                const { label, text, isPassword } = step;

                return (
                  <div key={index} className="input-item">
                    {isEditing ? (
                      <div className="input-item-edit">
                        <input
                          type="text"
                          className="input-edit-field"
                          value={editedLabel}
                          onChange={(e) => setEditedLabel(e.target.value)}
                          placeholder="Label"
                          autoFocus
                        />
                        {isPassword ? (
                          <div className="input-password-readonly">
                            {maskPassword(text)} (Password values cannot be edited)
                          </div>
                        ) : (
                          <textarea
                            className="input-edit-field input-edit-textarea"
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            placeholder="Value"
                            rows={3}
                          />
                        )}
                        <div className="input-edit-actions">
                          <button className="input-edit-btn input-edit-btn-save" onClick={handleSave}>
                            Save
                          </button>
                          <button className="input-edit-btn input-edit-btn-cancel" onClick={handleCancel}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="input-item-view">
                        <div className="input-item-header">
                          <span className="input-item-label">{label || "Unlabeled"}</span>
                          <button
                            className="input-edit-button"
                            onClick={() => handleEdit(activeTabId, index, label || "", text)}
                            title="Edit input"
                          >
                            ✏️
                          </button>
                        </div>
                        <div className="input-item-value">
                          {isPassword ? maskPassword(text) : text || "(empty)"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="inputs-panel-empty">
            <p>No input fields available</p>
            <p className="inputs-panel-empty-hint">Inputs will appear here when you add TYPE actions</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InputsPanel;

