import { useState } from 'react'
import { useSendStep } from '../../hooks/useSendStep';
import type { HeaderProps, Viewport } from '../../types';
import { runPixel } from "@semoss/sdk";
import { TextField } from '@mui/material';
import './header.css';



function Header(props : HeaderProps) {
  const {insightId, sessionId, shot, setShot, currentSteps, title, setTitle, setLoading, description, setDescription, mode, activeTabId} = props;
      const [url, setUrl] = useState("https://example.com");

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
              <button onClick={() => sendStep({ type: "NAVIGATE", url: url, waitAfterMs: 100, viewport, timestamp: Date.now() }, activeTabId, true)}>Open</button>
              <button onClick={saveSession} disabled={!sessionId}>
              Save
              </button>
              <span>Steps: {currentSteps ? currentSteps.length : 0}</span>
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