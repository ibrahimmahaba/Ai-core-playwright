import { useState } from 'react'
import { useSendStep } from '../../hooks/useSendStep';
import type { HeaderProps, Viewport } from '../../types';
import { runPixel } from "@semoss/sdk";
import { TextField } from '@mui/material';



function Header(props : HeaderProps) {
    const {insightId, sessionId, shot, setShot, steps, setSteps, title, setTitle, setLoading, description, setDescription,  mode} = props
    const [url, setUrl] = useState("https://example.com");

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
        
        <h2>Playwright Recorder App</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ width: 420 }}
            placeholder="Enter URL"
            />
            <button onClick={() => sendStep({ type: "NAVIGATE", url: url, waitAfterMs: 100, viewport, timestamp: Date.now() })}>Open</button>
            <button onClick={saveSession} disabled={!sessionId}>
            Save
            </button>
            <span>Steps: {steps ? steps.length : 0}</span>
            {mode === "crop" && <span style={{ color: "#ff0000", fontWeight: "bold" }}>
            Drag to select crop area
            </span>}
        </div>

        { shot && (
          <div
            style={{
              width: shot.width ? `${shot.width}px` : "75vw", // match screenshot width
              background: "#f5f6fa",
              padding: "16px",
              boxSizing: "border-box",
              marginBottom: "12px",
              borderRadius: "8px",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <TextField
                label="Title"
                value={title}
                required
                fullWidth
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
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
    </>
  )
}

export default Header