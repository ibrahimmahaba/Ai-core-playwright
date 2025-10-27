import { useEffect, useState } from 'react'
import { useSendStep } from '../../hooks/useSendStep';
import type { HeaderProps, ModelOption, Viewport } from '../../types';
import { runPixel } from "@semoss/sdk";
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import './header.css';

function Header(props : HeaderProps) {
    const {insightId, sessionId, shot, setShot, steps, setSteps, title,
      setTitle, setLoading, description, setDescription,  mode,
    selectedModel, setSelectedModel} = props

    const [url, setUrl] = useState("https://example.com");
    const [currUserModels, setCurrUserModels] = useState<Record<string, string>>({});
    const modelOptions: ModelOption[] = Object.entries(currUserModels).map(([name, id]) => ({
      label: name,
      value: id,
    }));

    useEffect(() => {
      async function getUserModels() {
        try {
          const pixel = `MyEngineProject(metaKeys = [], metaFilters=[{}], filterWord=[""], type=[["MODEL"]]);`;
          const res = await runPixel(pixel, insightId);
          const output = res.pixelReturn[0].output;
  
          if (Array.isArray(output)) {
            const userModelsMap = output.reduce((acc, item) => {
              acc[item.database_name] = item.database_id;
              return acc;
            }, {});
  
            setCurrUserModels((prev) => ({
              ...prev,
              ...userModelsMap,
            }));
          }
        } catch (err) {
          console.error("Fetch User Model err:", err);
        }
      }
      getUserModels();
    }, [insightId]);

    useEffect(() => {
      if (modelOptions.length > 0) {
        setSelectedModel(modelOptions[0]);
      } else {
        setSelectedModel(null);
      }
    }, [modelOptions]);

    const { sendStep } = useSendStep({
        insightId : insightId,
        sessionId : sessionId,
        shot: shot,
        setShot: setShot,
        steps: steps,
        setSteps: setSteps,
        setLoading: setLoading
    });

    const viewport: Viewport = {
        width: shot?.width ?? 1280,
        height: shot?.height ?? 800,
        deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
    };


    async function saveSession() {
        if (!sessionId) return;
      
        if (!title.trim()) {
          alert("Please enter a title before saving the session.");
          return;
        }
      
        const today = new Date().toISOString().split("T")[0];
        const name = `${title}-${today}`;
        try {
          const pixel = `SaveAll(
            sessionId="${sessionId}",
            name="${name}",
            title="${title}",
            description="${description}"
          );`;
      
          console.log("Running pixel:", pixel);
          const res = await runPixel(pixel, insightId);
          console.log("SaveAll success:", res.pixelReturn[0].output);
          alert("Session saved successfully!");
        } catch (err) {
          console.error("Error saving session:", err);
          alert("Failed to save session");
        }
      }
  return (
    <>
        
        <div className="header-container">
          <h2>Playwright Recorder App</h2>
          <div className="header-input-group">
              <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="header-input"
              placeholder="Enter URL"
              />
              <button onClick={() => sendStep({ type: "NAVIGATE", url: url, waitAfterMs: 100, viewport, timestamp: Date.now() })}>Open</button>
              <button onClick={saveSession} disabled={!sessionId}>
              Save
              </button>

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
                  <TextField {...params} label="Select LLM" placeholder="Search models..." />
                )}
                sx={{ minWidth: 250 }}
              />
              <span>Steps: {steps ? steps.length : 0}</span>
              {mode === "crop" && <span className="header-crop-mode">
              Drag to select crop area
              </span>}
          </div>

          { shot && (
            <div className="header-shot-container">
              <div className="header-title-field">
                <TextField
                  label="Title"
                  value={title}
                  required
                  fullWidth
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="header-description-field">
                <TextField
                  label="Description"
                  value={description}
                  fullWidth
                  multiline
                  rows={2}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
    </>
  )
}

export default Header