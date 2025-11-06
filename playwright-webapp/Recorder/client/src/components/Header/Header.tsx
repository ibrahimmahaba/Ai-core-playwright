import { useEffect, useMemo, useState } from 'react'
import { useSendStep } from '../../hooks/useSendStep';
import type { ModelOption, Viewport } from '../../types';
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../../utils/errorHandler";
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import './header.css';
import { useSessionStore } from '../../store/useSessionStore';
import { useToastNotificationStore } from '../../store/useToastNotificationStore';


function Header() {
  const {
    sessionId,
    insightId,
    shot,
    initSession,
    isInitialized,
    tabs,
    activeTabId,
    title,
    setTitle,
    description,
    setDescription,
    mode,
    selectedModel,
    setSelectedModel,
    loading,
    setLoading,
    resetSession,
    setIsSessionExpired,
  } = useSessionStore();

  const { showToast } = useToastNotificationStore();
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const [url, setUrl] = useState("https://example.com");
  const [currUserModels, setCurrUserModels] = useState<Record<string, string>>({});

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

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
          
          if (checkSessionExpired(res.pixelReturn)) {
            return;
          }
          
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
    }, [modelOptions, setSelectedModel]);

    const { sendStep } = useSendStep();

    const handleOpenClick = async () => {
      if (shot) {
        setShowSessionPrompt(true);
        return;
      }
      await proceedToNavigate();
    };
  
    const proceedToNavigate = async (explicitTabId?: string) => {
      let formattedUrl = url.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = "https://" + formattedUrl;
        setUrl(formattedUrl);
      }
      await sendStep({
        type: "NAVIGATE",
        url: formattedUrl,
        waitAfterMs: 100,
        viewport,
        timestamp: Date.now(),
      }, explicitTabId || activeTabId); 
    };
  
    const handleContinueExisting = async () => {
      setShowSessionPrompt(false);
      await proceedToNavigate(); 
    };
  
  const handleStartNewRecording = async () => {
    setShowSessionPrompt(false);
    const hasSteps = tabs.some(tab => tab.steps.length > 0);
    if (hasSteps) {
      setShowSaveWarning(true);
    } else {
      await proceedWithNewSession();
    }
  };

  const handleSaveAndStartNew = async () => {
    if (!title.trim()) {
      showToast("Please enter a title before saving the session.", "info");
      setShowSaveWarning(false);
      return; 
    }
    setShowSaveWarning(false);
    const saved = await saveSession();
    if (saved) {
      await proceedWithNewSession();
    }
  };

  const handleDontSaveAndStartNew = async () => {
    setShowSaveWarning(false);
    await proceedWithNewSession();
  };

  const proceedWithNewSession = async () => {
    setLoading(true);
    try {
      resetSession();
      
      await initSession(insightId, isInitialized);
      setIsSessionExpired(false);
      await new Promise(resolve => setTimeout(resolve, 500));
      await proceedToNavigate("tab-1");
    } catch (error) {
      showToast("Failed to create new session. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };


    async function saveSession(): Promise<boolean> {
        if (!sessionId) return false;

        if (!title.trim()) {
          showToast("Please enter a title before saving the session.", "error");
          return false;
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
      

          const res = await runPixel(pixel, insightId);
          
          if (checkSessionExpired(res.pixelReturn)) {
            return false;
          }
          
          console.log("SaveAll success:", res.pixelReturn[0].output);
          showToast("File saved successfully!", "success");
          await updateMCP();
          return true;
        } catch (err) {
          console.error("Error saving session:", err);
          showToast("Failed to save session", "error");
          return false;
        }
      }

    async function updateMCP() {
        try {
            const makePlaywrightPixel = `MakePlaywrightMCP(project="84ede0d8-6da3-4772-9968-e8554c538c8b")`;
            const makePlaywrightRes = await runPixel(makePlaywrightPixel, insightId);
            
            if (checkSessionExpired(makePlaywrightRes.pixelReturn)) {
              return;
            }
            
            console.log("MakePlaywrightMCP success:", makePlaywrightRes.pixelReturn[0].output);
            showToast("MCP updated successfully!", "success");
        } catch (makePlaywrightErr) {
            console.error("Error running MakePlaywrightMCP:", makePlaywrightErr);
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleOpenClick();
                }
              }}
              className="header-input"
              placeholder="Enter URL"
              />
              <button onClick={handleOpenClick} disabled={loading}>
                {loading ? 'Loading...' : 'Open'}
              </button>

              <button onClick={saveSession} disabled={!sessionId || loading}>
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
        <Dialog open={showSessionPrompt} onClose={() => setShowSessionPrompt(false)}>
          <DialogTitle>Continue or Start New Recording?</DialogTitle>
          <DialogContent>
            You already have an existing recording. Would you like to continue with it or start a new one?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSessionPrompt(false)} color="error" disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleContinueExisting} disabled={loading}>Continue Existing</Button>
            <Button onClick={handleStartNewRecording} color="primary" variant="contained" disabled={loading}>
              Start New
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={showSaveWarning} onClose={() => setShowSaveWarning(false)}>
          <DialogTitle>Save Current Recording?</DialogTitle>
          <DialogContent>
            You have {tabs.reduce((sum, tab) => sum + tab.steps.length, 0)} step(s) in your current recording. Would you like to save it before starting a new recording?
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDontSaveAndStartNew} color="error" disabled={loading}>
              Don't Save
            </Button>
            <Button onClick={() => setShowSaveWarning(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSaveAndStartNew} color="primary" variant="contained" disabled={loading}>
              Save & Start New
            </Button>
          </DialogActions>
        </Dialog>
    </>
  )
}

export default Header