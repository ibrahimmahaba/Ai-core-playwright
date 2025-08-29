import React, { useRef, useState } from "react";
import { useInsight } from "@semoss/sdk-react";
import { runPixel } from "@semoss/sdk";
import { 
  Mouse as MouseIcon, 
  Keyboard as KeyboardIcon, 
  ArrowUpward as ArrowUpIcon, 
  ArrowDownward as ArrowDownIcon 
} from "@mui/icons-material";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControlLabel, Checkbox } from "@mui/material";
type ScreenshotResponse = {
  base64Png: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
};
 
type Coords = { x: number; y: number };
type Viewport = { width: number; height: number; deviceScaleFactor: number };
 
type Step =
  | { type: "NAVIGATE"; url: string; waitUntil?: "networkidle" | "domcontentloaded"; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "CLICK"; coords: Coords; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "TYPE"; coords: Coords; text: string; pressEnter?: boolean; viewport: Viewport; waitAfterMs?: number; timestamp: number; label?: string }
  | { type: "SCROLL"; coords: Coords; deltaY?: number; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT"; waitAfterMs: number; viewport: Viewport; timestamp: number };
 
type StepsEnvelope = { version: "1.0"; steps: Step[] };
 
export default function RemoteRunner() {
  const [sessionId, setSessionId] = useState<any>();
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [url, setUrl] = useState("https://example.com");
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const { insightId } = useInsight();
  const [showData, setShowData] = React.useState(false);
  const [editedData, setEditedData] = React.useState<Record<string, string>>({});
  const [scriptName, setScriptName] = useState("script-1");
 
  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };
 
  async function createSession() {
    let pixel = `Playwright ( endpoint = [ "session" ] , paramValues = [ {"url":"${url}", "width": 1280, "height": 800, "deviceScaleFactor": 1} ] )`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: { sessionId: string; firstShot: ScreenshotResponse } };
 
    setSessionId(output['sessionId']);
    setShot(output['firstShot']);
    setSteps([
      {
        type: "NAVIGATE",
        url,
        waitUntil: "networkidle",
        viewport,
        timestamp: Date.now(),
      },
    ]);
  }
 
  async function sendStep(step: Step) {
    if (!sessionId) return;
 
    let pixel = `Playwright ( endpoint = [ "step" ] , sessionId = "${sessionId}", paramValues = [ ${JSON.stringify(step)} ] )`;
    const res = await runPixel(pixel, insightId);
    const data: ScreenshotResponse = res.pixelReturn[0].output as ScreenshotResponse;
 
    setShot(data);
    setSteps((prev) => [...prev, step]);
  }
 
  function imageToPageCoords(e: React.MouseEvent<HTMLImageElement, MouseEvent>): Coords {
    const img = imgRef.current!;
    const rect = img.getBoundingClientRect();
    const scaleX = shot!.width / rect.width;
    const scaleY = shot!.height / rect.height;
 
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
 
    return { x: Math.round(x), y: Math.round(y) };
  }

  type Mode = "click" | "type" | "scroll";
  const [mode, setMode] = useState<Mode>("click");

  const [scrollConfig, setScrollConfig] = useState({
    deltaY: 400,
  });

  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<Coords | null>(null);
  const [typeForm, setTypeForm] = useState({
    text: "",
    label: "",
    pressEnter: true,
    editable: false,
  });


  // async function handleClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
  //   if (!shot) return;
  //   const coords = imageToPageCoords(e);
  
  //   if (mode === "click") {
  //     await sendStep({
  //       type: "CLICK",
  //       coords,
  //       viewport,
  //       waitAfterMs: 300,
  //       timestamp: Date.now(),
  //     });
  //   } else if (mode === "type") {
  //     await sendStep({
  //       type: "TYPE",
  //       coords,
  //       text: typeConfig.text || "",
  //       pressEnter: typeConfig.pressEnter,
  //       viewport,
  //       waitAfterMs: 300,
  //       timestamp: Date.now(),
  //       label: typeConfig.label || "",
  //     });
  //   } else if (mode === "scroll") {
  //     await sendStep({
  //       type: "SCROLL",
  //       coords,
  //       deltaY: scrollConfig.deltaY,
  //       viewport,
  //       waitAfterMs: 300,
  //       timestamp: Date.now(),
  //     });
  //   }
  // }

  async function handleClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);
  
    if (mode === "click") {
      await sendStep({
        type: "CLICK",
        coords,
        viewport,
        waitAfterMs: 300,
        timestamp: Date.now(),
      });
    } else if (mode === "type") {
      // Open dialog instead of sending immediately
      setPendingCoords(coords);
      setShowTypeDialog(true);
    } else if (mode === "scroll") {
      await sendStep({
        type: "SCROLL",
        coords,
        deltaY: scrollConfig.deltaY,
        viewport,
        waitAfterMs: 300,
        timestamp: Date.now(),
      });
    }
  }
  
  
 
  async function replay() {
    if (!sessionId) return;
    const envelope: StepsEnvelope = { version: "1.0", steps };
 
    let pixel = `Playwright ( endpoint = [ "replay" ] , sessionId = "${sessionId}", paramValues = [ ${JSON.stringify(envelope)} ] )`;
    const res = await runPixel(pixel, insightId);
    const data: ScreenshotResponse = res.pixelReturn[0].output as ScreenshotResponse;
 
    setShot(data);
  }
 
  async function save() {
    if (!sessionId) return;
    const name = window.prompt("Save as (name or filename.json):", scriptName) || scriptName;
 
    let pixel = `Playwright ( endpoint = [ "save" ] , sessionId = "${sessionId}", paramValues = [ {"name": "${name}"} ] )`;
    const res = await runPixel(pixel, insightId);
    const data = res.pixelReturn[0].output as { file: string };
 
    setScriptName(name);
    alert(`Saved to: ${data.file}`);
  }
 
  async function replayFromFile(optionalName?: string) {
    if (!sessionId) return;
 
    const name =
      optionalName ||
      window.prompt("Replay file (name in 'recordings' or absolute path):", scriptName) ||
      scriptName;
 
    let pixel = `Playwright ( endpoint = [ "replayFile" ] , sessionId = "${sessionId}", paramValues = [ { "name": "${name}" } ] )`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: any };
 
    if (output && typeof output === "object" && output.base64Png) {
      setShot(output as ScreenshotResponse);
    } else {
      console.error("Invalid response structure:", output);
      alert("Error: Invalid response from replayFile endpoint");
    }
  }
 
  async function editRecording() {
    const name = window.prompt("Replay file (name in 'recordings' or absolute path):", scriptName) || scriptName;
    let pixel = `GetPlaywrightScriptVariables(Script="${name}");`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: Record<string, string> };
 
    setEditedData({ ...output });
    setShowData(true);
    replayFromFile(name);
  }
 
 
async function updatePlaywrightScript(currentDataParam?: Record<string, string>) {
    const currentData = currentDataParam ?? editedData;
 
    if (!currentData || Object.keys(currentData).length === 0) {
      alert("No variables provided!");
      return;
    }
 
    const name = window.prompt("Enter file (name in 'recordings' or absolute path):", scriptName) || scriptName;
    const newName = window.prompt("Enter the new file name:", scriptName) || scriptName;

    let Variables = Object.entries(currentData)
    .map(([k, v]) => `{ "${k}": "${v}" }`)
    .join(", ");

    alert("Data being sent: " + Variables);

    const updatePixel = `UpdatePlaywrightScriptVariables(Script="${name}", Variables=[${Variables}], OutputScript="${newName}")`;
    try {
    const updateRes = await runPixel(updatePixel, insightId);
    const { output } = updateRes.pixelReturn[0] as { output: string };
    replayFromFile(output);
    } catch (err) {
    console.error("Failed to update script:", err);
    alert("Error updating script");
    }
}
 
 
  return (
    <div style={{ padding: 16 }}>

      {/* --- Mode Toolbar --- */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "20px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 8,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          alignItems: "center",
        }}
      >

      {([
        { m: "click", icon: <MouseIcon />, label: "Click" },
        { m: "type", icon: <KeyboardIcon />, label: "Type" },
        { m: "scroll-up", icon: <ArrowUpIcon />, label: "Scroll Up" },
        { m: "scroll-down", icon: <ArrowDownIcon />, label: "Scroll Down" },
      ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => {
              if (m === "scroll-up") {
                setMode("scroll");
                setScrollConfig({ deltaY: -400 });
              } else if (m === "scroll-down") {
                setMode("scroll");
                setScrollConfig({ deltaY: 400 });
              } else {
                setMode(m as Mode);
              }
            }}
            title={label}
            aria-pressed={active}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: active ? "2px solid #666" : "1px solid #bbb",
              background: active ? "#e0e0e0" : "#fafafa",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              color: active ? "#444" : "#888",
              fontSize: "18px",
              padding: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderRadius = "12px"; // softer on hover
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderRadius = "50%"; // back to circle
            }}
          >
            {icon}
          </button>
        );
      })}

      </div>

      <h2>Remote Playwright Runner</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ width: 420 }}
          placeholder="Enter URL"
        />
        <button onClick={createSession}>Open</button>
        <button onClick={replay} disabled={!sessionId}>
          Replay (Current Steps)
        </button>
        <button onClick={save} disabled={!sessionId}>
          Save
        </button>
        <button onClick={() => replayFromFile()} disabled={!sessionId}>
          Replay From File
        </button>
        <button onClick={editRecording} disabled={!sessionId}>
          Load Recording (Edit)
        </button>
        <span>Steps: {steps.length}</span>
      </div>
 
      {showData && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
          <h4>Edit Replay Variables ({Object.keys(editedData).length})</h4>
 
          {Object.keys(editedData).length === 0 ? (
            <div>No variables found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}>Label</th>
                  <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(editedData).map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{label}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>
                      <input
                        style={{ width: "100%" }}
                        value={value}
                        onChange={(e) =>
                          setEditedData((cur) => ({ ...cur, [label]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
 
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
                await updatePlaywrightScript(editedData);
                setShowData(false);
            }}
            >
            Run With These
        </button>
 
            <button onClick={() => setShowData(false)}>Cancel</button>
          </div>
        </div>
      )}
      {shot && (
        <img
          ref={imgRef}
          onClick={handleClick}
          src={`data:image/png;base64,${shot.base64Png}`}
          alt="remote"
          style={{
            border: "1px solid #ccc",
            maxWidth: "100%",
            cursor: mode === "type" ? "text" : mode === "scroll" ? "ns-resize" : "pointer",
          }}
        />
      )}

    <Dialog open={showTypeDialog} onClose={() => setShowTypeDialog(false)}>
      <DialogTitle>Type Input</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 400 }}>
        <TextField
          label="Text"
          value={typeForm.text}
          onChange={(e) => setTypeForm((cur) => ({ ...cur, text: e.target.value }))}
          required
        />
        <TextField
          label="Label (Optional)"
          value={typeForm.label}
          onChange={(e) => setTypeForm((cur) => ({ ...cur, label: e.target.value }))}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={typeForm.pressEnter}
              onChange={(e) => setTypeForm((cur) => ({ ...cur, pressEnter: e.target.checked }))}
            />
          }
          label="Press Enter after typing"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={typeForm.editable}
              onChange={(e) => setTypeForm((cur) => ({ ...cur, editable: e.target.checked }))}
            />
          }
          label="Editable"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowTypeDialog(false)}>Cancel</Button>
        <Button
          variant="contained"
          onClick={async () => {
            if (!pendingCoords) return;

            await sendStep({
              type: "TYPE",
              coords: pendingCoords,
              text: typeForm.text,
              pressEnter: typeForm.pressEnter,
              viewport,
              waitAfterMs: 300,
              timestamp: Date.now(),
              label: typeForm.label || "",
            });

            setShowTypeDialog(false);
            setPendingCoords(null);
            setTypeForm({ text: "", label: "", pressEnter: true, editable: false });
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>

    </div>
  );
}
 