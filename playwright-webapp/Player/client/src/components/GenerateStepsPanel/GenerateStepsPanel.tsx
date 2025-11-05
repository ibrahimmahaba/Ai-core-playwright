import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import type { ModelOption } from "../../types";
import './GenerateStepsPanel.css';

interface GenerateStepsPanelProps {
  modelOptions: ModelOption[];
  selectedModel: ModelOption | null;
  setSelectedModel: React.Dispatch<React.SetStateAction<ModelOption | null>>;
  generationUserPrompt: string;
  setGenerationUserPrompt: React.Dispatch<React.SetStateAction<string>>;
  onGenerate: () => void;
}

function GenerateStepsPanel(props: GenerateStepsPanelProps) {
  const {
    modelOptions,
    selectedModel,
    setSelectedModel,
    generationUserPrompt,
    setGenerationUserPrompt,
    onGenerate
  } = props;

  return (
    <div className="generate-steps-panel">
      <div className="generate-steps-panel-content">
        <div className="configure-llm-chip">Configure LLM</div>
        <div className="generate-steps-panel-card">
          <div className="generate-steps-panel-body">
            <label className="choose-model-label">Choose your preferred LLM model:</label>
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
            <div className="generate-steps-panel-actions">
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

export default GenerateStepsPanel;

