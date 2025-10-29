import { useEffect, useMemo, useState } from 'react'
import { useSendStep } from '../../hooks/useSendStep';
import type { HeaderProps, ModelOption, Viewport } from '../../types';
import { runPixel } from "@semoss/sdk";
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import './header.css';

function Header(props : HeaderProps) {
    const {insightId, sessionId, shot, setShot, title,
      setTitle, setLoading, description, setDescription,  mode,
    selectedModel, setSelectedModel, activeTabId} = props

    const [url, setUrl] = useState("https://example.com");
    const [currUserModels, setCurrUserModels] = useState<Record<string, string>>({});
    const modelOptions: ModelOption[] = useMemo(() => 
      Object.entries(currUserModels).map(([name, id]) => ({
        label: name,
        value: id,
      })), 
      [currUserModels]
    );

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
      console.log("Model options updated:", modelOptions);
    }, [modelOptions, setSelectedModel]);

      const { sendStep } = useSendStep({
        insightId : insightId,
        sessionId : sessionId,
        shot: shot,
        setShot: setShot,
        setLoading: setLoading,
        tabs: props.tabs,
        setTabs: props.setTabs,
        _activeTabId: activeTabId,
        setActiveTabId: props.setActiveTabId
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
              <button
                onClick={() => {
                  let formattedUrl = url.trim();
                  if (!/^https?:\/\//i.test(formattedUrl)) {
                    formattedUrl = "https://" + formattedUrl;
                    setUrl(formattedUrl); 
                  }
                  sendStep({
                    type: "NAVIGATE",
                    url: formattedUrl,
                    waitAfterMs: 100,
                    viewport,
                    timestamp: Date.now()
                  }, activeTabId,true);
                }}
              >
                Open
              </button>

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
                      <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                        {option.value}
                      </Typography>
                    </div>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Select LLM" placeholder="Search models..." size="small" />
                )}
                sx={{ minWidth: 300 }}
              />
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