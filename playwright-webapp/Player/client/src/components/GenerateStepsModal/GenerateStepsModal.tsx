import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import type { GenerateStepsModalProps, ModelOption } from "../../types";
import './GenerateStepsModal.css';

function GenerateStepsModal(props: GenerateStepsModalProps) {
  const {
    isOpen,
    onClose,
    modelOptions,
    selectedModel,
    setSelectedModel,
    generationUserPrompt,
    setGenerationUserPrompt,
    onGenerate
  } = props;

  if (!isOpen) return null;

  return (
    <div className="generate-steps-modal-overlay" onClick={onClose}>
      <div className="generate-steps-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="configure-llm-chip">Configure LLM</div>
        <div className="generate-steps-modal-card">
          <div className="generate-steps-modal-body">
            <label className="choose-model-label">Choose your preferred LLM model :</label>
            <label className="select-model-label">Select model</label>
            <Autocomplete
              options={modelOptions}
              value={selectedModel}
              onChange={(_, newValue) => setSelectedModel(newValue)}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <div>
                    <Typography variant="body1">{option.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      {option.value}
                    </Typography>
                  </div>
                </Box>
              )}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  placeholder="Placeholder"
                  className="model-select-input"
                />
              )}
              className="model-select-autocomplete"
            />
            <div className="generate-steps-modal-actions">
              <button 
                className="generate-steps-cancel-button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                className="generate-steps-generate-button"
                onClick={onGenerate}
                disabled={!selectedModel}
              >
                Generate Steps
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenerateStepsModal;

