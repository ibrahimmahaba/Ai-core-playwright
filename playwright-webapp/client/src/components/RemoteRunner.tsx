// src/components/RemoteRunner.tsx
import React, { useRef, useState } from "react";
import { useInsight } from "@semoss/sdk-react";
import { runPixel } from "@semoss/sdk";
import { CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Menu, MenuItem } from "@mui/material";

type ScreenshotResponse = {
  base64Png: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
};

type Coords = { x: number; y: number };
type Viewport = { width: number; height: number; deviceScaleFactor: number };

type Step =
  | { type: "NAVIGATE"; url: string; waitUntil?: "networkidle"|"domcontentloaded"; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "CLICK"; coords: Coords; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "TYPE"; coords: Coords; text: string; pressEnter?: boolean; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "SCROLL"; coords: Coords; deltaY?: number; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT"; waitAfterMs: number; viewport: Viewport; timestamp: number };

type StepsEnvelope = { version: "1.0"; steps: Step[] };

export default function RemoteRunner() {

  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptTitle, setPromptTitle] = useState<string>("");
  const [promptValue, setPromptValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const promptResolve = useRef<((v: string | null) => void) | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isPromptType, setIsPromptType] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, string>>({});


  async function fetchMetadata() {
    const res = await runPixel("Playwright ( endpoint = [ \"metadata\" ] )", insightId);
    const { output } = res.pixelReturn[0]
    setMetadata(output as Record<string, string>);
  };

  function promptMui(message: string, defaultValue: string = ""): Promise<string | null> {
    setPromptTitle(message);
    setPromptValue(defaultValue);
    return new Promise<string | null>((resolve) => {
      promptResolve.current = resolve;
      setIsPromptOpen(true);
    });
  }

  function handlePromptCancel() {
    setIsPromptOpen(false);
    setIsPromptType(false);
    promptResolve.current && promptResolve.current(null);
    promptResolve.current = null;
  }

  function handlePromptOk() {
    setIsPromptOpen(false);
    promptResolve.current && promptResolve.current(promptValue);
    promptResolve.current = null;
  }
  const [sessionId, setSessionId] = useState<any>();
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [url, setUrl] = useState("https://example.com");
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const { insightId } = useInsight();

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1
  };

  async function createSession() {

    fetchMetadata();
    let pixel = `Playwright ( endpoint = [ "session" ] , paramValues = [ {"url":"${url}", "width": 1280, "height": 800, "deviceScaleFactor": 1} ] )`;
    const res = await runPixel(pixel, insightId);
    const { output } = await res.pixelReturn[0] as { output: { sessionId: string, firstShot: ScreenshotResponse } };

    setSessionId(output['sessionId']);
    setShot(output['firstShot']);
    // Also push NAVIGATE step locally so replay matches
    setSteps([{
      type: "NAVIGATE",
      url,
      waitUntil: "networkidle",
      viewport,
      timestamp: Date.now()
    } as Step]);
    
  }

  async function sendStep(step: Step) {
    if (!sessionId) return;

    setLoading(true);
    try{
      let pixel = `Playwright ( endpoint = [ "step" ] , sessionId = "${sessionId}", paramValues = [ ${JSON.stringify(step)} ] )`;
      const res = await runPixel(pixel, insightId);

      const { output } = res.pixelReturn[0];

      const data: ScreenshotResponse = output as ScreenshotResponse;
      setShot(data);
      setSteps(prev => [...prev, step]);
    } finally {
      setLoading(false);
    }
  }

  function imageToPageCoords(e: React.MouseEvent<HTMLImageElement, MouseEvent>): Coords {
    const img = imgRef.current!;
    const rect = img.getBoundingClientRect();
    const scaleX = (shot!.width) / rect.width;
    const scaleY = (shot!.height) / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Round to int CSS pixels
    return { x: Math.round(x), y: Math.round(y) };
  }

  async function handleClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);

    const mode = await promptMui("Action? (click/type/scroll)", "click");
    if (!mode) return;

    if (mode === "click") {
      await sendStep({
        type: "CLICK",
        coords, viewport, waitAfterMs: 300, timestamp: Date.now()
      } as Step);
    } else if (mode === "type") {
      setIsPromptType(true);
      const text = await promptMui("Text to type:", "");
      if (text == null)
        return; // User cancelled
      const pressEnter = window.confirm("Press Enter after typing?");
      setIsPromptType(false);
      await sendStep({
        type: "TYPE",
        coords, text: text || "", pressEnter, viewport, waitAfterMs: 300, timestamp: Date.now()
      } as Step);
    } else if (mode === "scroll") {
      await sendStep({
        type: "SCROLL",
        coords, deltaY: 400, viewport, waitAfterMs: 300, timestamp: Date.now()
      } as Step);
    }
  }

  async function replay() {
    if (!sessionId) return;
    const envelope: StepsEnvelope = { version: "1.0", steps };
    // const res = await fetch(`${API}/${sessionId}/replay`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ steps: envelope })
    // });

    let pixel = `Playwright ( endpoint = [ "replay" ] , sessionId = "${sessionId}", paramValues = [  "steps": {${envelope}} ] )`;
    const res = await runPixel(pixel, insightId);

    // const res = await fetch(`${API}/engine/runPixel`, {
    //   method: "POST",
    //   headers: { 
    //     "Content-Type": "application/json" 
    //   },
    //   body: JSON.stringify({ 
    //     expression: `Playwright ( endpoint = [ "replay" ] , sessionId = "${sessionId}", paramValues = [  "steps": {${envelope}} ] )`,
    //     insightId: insightId
    //   })
    // });
    
    const data: ScreenshotResponse = await res.pixelReturn[0].output as ScreenshotResponse;
    setShot(data);
  }
const [scriptName, setScriptName] = useState("script-1");

async function save() {
  if (!sessionId) return;
  const name = await promptMui("Save as (name or filename.json):", scriptName) || scriptName;

  let pixel = `Playwright ( endpoint = [ "save" ] , sessionId = "${sessionId}", paramValues = [  {"name": "${name}"} ] )`;
  const res = await runPixel(pixel, insightId);
  const data = await res.pixelReturn[0].output as { file: string };

  setScriptName(name);
  alert(`Saved to: ${data.file}`);
}

async function replayFromFile() {
  if (!sessionId) return;
  const name = await promptMui("Replay file (name in 'recordings' or absolute path):", scriptName) || scriptName;

  let pixel = `Playwright ( endpoint = [ "replayFile" ] , sessionId = "${sessionId}", paramValues = [ { "name" : "${name}"} ] )`;
  const res = await runPixel(pixel, insightId);

  const { output } = res.pixelReturn[0] as { output: any };

  if (output && typeof output === 'object' && output.base64Png) {
    setShot(output as ScreenshotResponse);
  } else {
    console.error("Invalid response structure:", output);
    alert("Error: Invalid response from replayFile endpoint");
  }
}

return (
  <div style={{ padding: 16 }}>
    <h2>Remote Playwright Runner</h2>
    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
      <input value={url} onChange={e => setUrl(e.target.value)} style={{ width: 420 }} />
      <button onClick={createSession}>Open</button>
      <button onClick={replay} disabled={!sessionId}>Replay (Current Steps)</button>
      <button onClick={save} disabled={!sessionId}>Save</button>
      <button onClick={replayFromFile} disabled={!sessionId}>Replay From File</button>
      <span>Steps: {steps.length}</span>
    </div>

    {shot && (
    <div style={{ position: "relative", display: "inline-block" }}>
      <img
        ref={imgRef}
        onClick={handleClick}
        src={shot ? `data:image/png;base64,${shot.base64Png}` : undefined}
        alt="screenshot"
        style={{ border: "1px solid #ccc", maxWidth: "100%", cursor: "crosshair" }}
        onLoad={() => setLoading(false)} // hide spinner once image loads
      />
    
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <CircularProgress color="inherit" />
        </div>
      )}
    </div>
    )}

    <Dialog open={isPromptOpen} onClose={handlePromptCancel}>
      <DialogTitle>{promptTitle || "Enter value"}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          fullWidth
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { handlePromptOk(); } }}
        />
        {isPromptType && (
        <>
          <Button
            variant="outlined"
            onClick={(e) => setAnchorEl(e.currentTarget)} // open menu
          >
            Insert Var
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            {Object.entries(metadata).map(([key, value]) => (
              <MenuItem
                key={key}
                onClick={() => {
                  setPromptValue(promptValue + value);
                  setAnchorEl(null);
                }}
              >
                {key}
              </MenuItem>
            ))}
          </Menu>
        </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handlePromptCancel}>Cancel</Button>
        <Button onClick={handlePromptOk} variant="contained">OK</Button>
      </DialogActions>
    </Dialog>
  </div>
);
}