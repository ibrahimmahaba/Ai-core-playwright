import { useState } from "react";
import type { Action } from "../../types";
import './InputsPanel.css';

interface InputsPanelProps {
  editedData: Action[];
  setEditedData: React.Dispatch<React.SetStateAction<Action[]>>;
}

function InputsPanel(props: InputsPanelProps) {
  const { editedData, setEditedData } = props;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedLabel, setEditedLabel] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");

  // Get all TYPE actions (inputs)
  const inputActions = editedData
    .map((action, index) => ("TYPE" in action ? { action, index } : null))
    .filter((item): item is { action: Action; index: number } => item !== null);

  const handleEdit = (index: number, label: string, text: string) => {
    setEditingIndex(index);
    setEditedLabel(label);
    setEditedText(text);
  };

  const handleSave = () => {
    if (editingIndex === null) return;

    const actualIndex = inputActions[editingIndex].index;
    const updatedData = [...editedData];
    
    if ("TYPE" in updatedData[actualIndex]) {
      updatedData[actualIndex] = {
        TYPE: {
          ...updatedData[actualIndex].TYPE,
          label: editedLabel,
          text: editedText,
        }
      };
      setEditedData(updatedData);
    }

    setEditingIndex(null);
    setEditedLabel("");
    setEditedText("");
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditedLabel("");
    setEditedText("");
  };

  const maskPassword = (text: string) => {
    return "•".repeat(Math.min(text.length, 20));
  };

  return (
    <div className="inputs-panel">
      <div className="inputs-panel-content">
        {inputActions.length > 0 ? (
          <>
            <h3 className="inputs-panel-section-title">Inputs ({inputActions.length})</h3>
            <div className="inputs-list">
              {inputActions.map(({ action, index: actualIndex }, listIndex) => {
                if (!("TYPE" in action)) return null;
                
                const isEditing = editingIndex === listIndex;
                const { label, text, isPassword } = action.TYPE;

                return (
                  <div key={actualIndex} className="input-item">
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
                            onClick={() => handleEdit(listIndex, label, text)}
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

