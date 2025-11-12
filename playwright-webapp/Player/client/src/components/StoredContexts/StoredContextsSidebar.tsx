import { useState, useRef, useEffect } from "react";
import { TextField, IconButton } from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";
import StyledPrimaryButton from "../StyledButtons/StyledPrimaryButton";
import StyledButton from "../StyledButtons/StyledButtonRoot";
import type { StoredContextsSidebarProps } from "../../types";
import {Insight}  from 'https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.29/+esm';
import './StoredContextsSidebar.css';

function StoredContextsSidebar(props: StoredContextsSidebarProps) {
  const { storedContexts, setStoredContexts, sessionId, onClose } = props;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const editingRef = useRef<HTMLDivElement>(null);

  // Handle click outside to exit edit mode
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editingIndex !== null && editingRef.current && !editingRef.current.contains(event.target as Node)) {
        setEditingIndex(null);
      }
    }

    if (editingIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [editingIndex]);

  function handleEditContext(index: number) {
    setEditingIndex(index);
    setEditingText(storedContexts[index]);
  }

  function handleSaveEdit() {
    if (editingIndex !== null) {
      const updated = [...storedContexts];
      updated[editingIndex] = editingText;
      setStoredContexts(updated);
      setEditingIndex(null);
    }
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setEditingText("");
  }

  function handleDeleteContext(index: number) {
    if (confirm("Are you sure you want to delete this context?")) {
      setStoredContexts(storedContexts.filter((_, i) => i !== index));
    }
  }

  function removeSpecialCharacters(input: string): string {
    return input.replace(/["'\\]/g, "");
  }

  async function handleSendAllToPlayground() {
  if (storedContexts.length === 0) {
    alert("No contexts to send.");
    return;
  }

  setIsSending(true);
  try {
    // Simply concatenate all contexts with separators
    const combinedContext = storedContexts.join("\n\n");
    
    const sanitizedContext = removeSpecialCharacters(combinedContext);
    const insight = new Insight();
    await insight.initialize();
    
    const { output } = await insight.actions.runMCPTool("AddVisionContext", {
      visionContext: sanitizedContext,
      sessionId: sessionId
    });

    console.log('All vision contexts sent to playground successfully:', output);
    alert(`Successfully sent ${storedContexts.length} context(s) to playground!`);
  } catch (error) {
    console.error("Error sending contexts to playground:", error);
    alert("Failed to send contexts to playground. Error: " + error);
  } finally {
    setIsSending(false);
  }
}

  return (
    <div className="expanded-contexts-overlay" onClick={onClose}>
      <div className="expanded-contexts-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="expanded-contexts-header">
          <h2>Stored Contexts</h2>
          <div className="expanded-contexts-header-actions">
            {storedContexts.length > 0 && (
              <StyledPrimaryButton 
                onClick={handleSendAllToPlayground}
                disabled={isSending}
              >
                {isSending ? "Sending..." : "Send All to Playground"}
              </StyledPrimaryButton>
            )}
            <button className="expanded-contexts-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="expanded-contexts-body">
          {storedContexts.length === 0 ? (
            <p className="expanded-contexts-empty">No contexts stored yet</p>
          ) : (
            <div className="expanded-contexts-grid">
              {storedContexts.map((context, index) => {
                const isEditing = editingIndex === index;

                return (
                  <div 
                    key={index} 
                    className="expanded-context-item"
                    ref={isEditing ? editingRef : null}
                  >
                    {isEditing ? (
                      <>
                        <TextField
                          fullWidth
                          multiline
                          rows={6}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          autoFocus
                          variant="outlined"
                        />
                        <div className="expanded-context-actions">
                          <StyledPrimaryButton onClick={handleSaveEdit} fullWidth>
                            Save
                          </StyledPrimaryButton>
                          <StyledButton onClick={handleCancelEdit} fullWidth>
                            Cancel
                          </StyledButton>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="expanded-context-header">
                          <span className="expanded-context-number">Context {index + 1}</span>
                          <div className="expanded-context-header-actions">
                            <IconButton 
                              size="small" 
                              onClick={() => handleEditContext(index)}
                              title="Edit context"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteContext(index)}
                              title="Delete context"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </div>
                        </div>
                        <div className="expanded-context-text">
                          {context}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StoredContextsSidebar;