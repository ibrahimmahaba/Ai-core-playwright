import React, { useRef, useState, type JSX } from "react";
import { runPixel } from "@semoss/sdk";
import {
  Mouse as MouseIcon,
  Keyboard as KeyboardIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  AccessTime as AccessTimeIcon,
  Sync as SyncIcon,
} from "@mui/icons-material";
import { CircularProgress, TextField, FormControlLabel, Checkbox } from "@mui/material";
import { IconButton } from "@mui/material";
import { Check, Close } from "@mui/icons-material";
import Draggable from "react-draggable";

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
  | {
    type: "TYPE";
    coords: Coords;
    text: string;
    pressEnter?: boolean;
    viewport: Viewport;
    waitAfterMs?: number;
    timestamp: number;
    label?: string;
    isPassword?: boolean;   
    storeValue?: boolean;
    }
  | { type: "SCROLL"; coords: Coords; deltaY?: number; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT"; waitAfterMs: number; viewport: Viewport; timestamp: number };

type VariableRecord = { label: string; text: string; isPassword?: boolean };
type RemoteRunnerProps = {
  sessionId: string; 
  metadata: Record<string, string>; 
  insightId: string;
}

export default function RemoteRunner({ sessionId, insightId }: RemoteRunnerProps)  {

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [url, setUrl] = useState("https://example.com");
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [showData, setShowData] = React.useState(false);
  const [editedData, setEditedData] = React.useState<VariableRecord[]>([]);
  const [updatedData, setUpdatedData] = React.useState<VariableRecord[]>([]);
  const [scriptName] = useState("script-1");

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  async function sendStep(step: Step) {
    if (!sessionId) return;

    setLoading(true);
    try {
      let pixel = `Step ( sessionId = "${sessionId}", shouldStore = ${typeForm.storeValue}, paramValues = [ ${JSON.stringify(step)} ] )`;
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
    const scaleX = shot!.width / rect.width;
    const scaleY = shot!.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x: Math.round(x), y: Math.round(y) };
  }

  type Mode = "click" | "type" | "scroll";
  const [mode, setMode] = useState<Mode>("click");

  const [scrollConfig] = useState({
    deltaY: 400,
  });

  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<Coords | null>(null);
  const [typeForm, setTypeForm] = useState({
    text: "",
    label: "",
    pressEnter: false,
    editable: false,
    isPassword: false,  
    storeValue: true,    
  });

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
      setPendingCoords({
        ...coords,
        clientX: e.clientX,
        clientY: e.clientY,
      } as any); // keep both
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

  async function replayFromFile(optionalName?: string) {
    setLoading(true);
    try{
    const name =
      optionalName ||
      window.prompt("Replay file (name in 'recordings' or absolute path):", scriptName) ||
      scriptName;

    let pixel = `ReplayFromFile ( sessionId = "${sessionId}", paramValues = [ { "name": "${name}" } ] )`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: any };

    if (output && typeof output === "object" && output.base64Png) {
      setShot(output as ScreenshotResponse);
    } else {
      console.error("Invalid response structure:", output);
      alert("Error: Invalid response from replayFile endpoint");
    }
  } finally {
    setLoading(false);
  }
}

  async function updatePlaywrightScript(currentDataParam?: VariableRecord[]) {
    const currentData = currentDataParam ?? updatedData;
    if (!currentData || Object.keys(currentData).length === 0) {
      alert("No variables provided!");
      return;
    }

    const newName = window.prompt("Enter the new file name:", scriptName) || scriptName;

    let Variables = Object.entries(currentData)
      .map(([k, v]) => `{ "${k}": "${v}" }`)
      .join(", ");
    
    let metadataVariables = Object.entries(currentData)
    .filter(([k]) => k === "title" || k === "description")
    .map(([k, v]) => `{ "${k}": "${v}" }`)
    .join(", ");

    if (metadataVariables) {
      const patchPixel = `PatchFileMeta(name="${scriptName}", paramValues=[${metadataVariables}])`;
      await runPixel(patchPixel, insightId);
    }
    const updatePixel = `UpdatePlaywrightScriptVariables(Script="${scriptName}", Variables=[${Variables}], OutputScript="${newName}")`;
    try {
      const updateRes = await runPixel(updatePixel, insightId);
      const { output } = updateRes.pixelReturn[0] as { output: string };
      replayFromFile(output);
    } catch (err) {
      console.error("Failed to update script:", err);
      alert("Error updating script");
    }
  }

  async function saveSession() {
    if (!sessionId) return;
  
    if (!title.trim()) {
      alert("Please enter a title before saving the session.");
      return;
    }
  
    // build envelope for the first paramValues element
    const envelope = {
      version: "1.0",
      meta: {
        title: title,
        description: description,
      },
      steps: steps
    };
    const today = new Date().toISOString().split("T")[0];
    const name = title ? `${title}-${today}`: `${scriptName}`;
    try {
      const pixel = `SaveAll(
        sessionId="${sessionId}",
        name="${name}",
        title="${title}",
        description="${description}",
      )`;
  
      console.log("Running pixel:", pixel);
      const res = await runPixel(pixel, insightId);
      console.log("SaveAll success:", res.pixelReturn[0].output);
      alert("Session saved successfully!");
    } catch (err) {
      console.error("Error saving session:", err);
      alert("Failed to save session");
    }
  }

  function normalizeShot(raw: any | undefined | null): ScreenshotResponse | undefined {
    if (!raw) return undefined;
    const base64 =
      raw.base64Png ?? raw.base64 ?? raw.imageBase64 ?? raw.pngBase64 ?? raw.data ?? "";
    const width = raw.width ?? raw.w ?? 1280;
    const height = raw.height ?? raw.h ?? 800;
    const dpr = raw.deviceScaleFactor ?? raw.dpr ?? 1;
    if (!base64 || typeof base64 !== "string") return undefined;
    return { base64Png: base64, width, height, deviceScaleFactor: dpr };
  }

  async function fetchScreenshot() {
    if (!sessionId) return;
    try {
      let pixel = `Screenshot ( sessionId = "${sessionId}" )`;
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0];
      const snap = normalizeShot(output);
      if (snap) setShot(snap);
    } catch (err) {
      console.error("fetchScreenshot error:", err);
    }
  }

  async function waitAndShot() {
    if (!sessionId) return;
    const ms = Number(window.prompt("Wait how many ms?", "800")) || 800;
    const step: Step = { type: "WAIT", waitAfterMs: ms, viewport, timestamp: Date.now() };
    await sendStep(step); // server will wait + return a fresh screenshot
  }
  
  return (
    <div style={{ padding: 16 }}>
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
          { m: "delay", icon: <AccessTimeIcon />, label: "Delay" },
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" }

        ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
          const active = mode === m;

          return (
            <button
              key={m}
              onClick={async () => {
                if (m === "scroll-up") {
                  if (!shot) return;
                  await sendStep({
                    type: "SCROLL",
                    coords: { x: 0, y: 0 },
                    deltaY: -400,
                    viewport,
                    waitAfterMs: 300,
                    timestamp: Date.now(),
                  });
                } else if (m === "scroll-down") {
                  if (!shot) return;
                  await sendStep({
                    type: "SCROLL",
                    coords: { x: 0, y: 0 },
                    deltaY: 400,
                    viewport,
                    waitAfterMs: 300,
                    timestamp: Date.now(),
                  });
                } else if (m == "delay") {
                  await waitAndShot();
                } else if (m == "fetch-screenshot") {
                  await fetchScreenshot();
                }
                else {
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
                (e.currentTarget as HTMLButtonElement).style.borderRadius = "12px";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderRadius = "50%";
              }}
            >
              {icon}
            </button>
          );
        })}
      </div>


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
        <span>Steps: {steps.length}</span>
      </div>
      {!shot && loading && (
        <div
        style={{
          width: "100%",
          height: "500px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f6fa",
          padding: "16px",
          boxSizing: "border-box",
          marginBottom: "12px",
          borderRadius: "8px",
        }}
        >{loading && <CircularProgress />}
        </div>
      )}

      {shot && (
        <>
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

          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              ref={imgRef}
              onClick={handleClick}
              src={`data:image/png;base64,${shot.base64Png}`}
              alt="remote"
              style={{
                border: "1px solid #ccc",
                maxWidth: "100%",
                cursor:
                  mode === "type"
                    ? "text"
                    : mode === "scroll"
                    ? "ns-resize"
                    : "pointer",
              }}
              onLoad={() => setLoading(false)}
            />
            
            {/* // float slightly above click */}

            {showTypeDialog && pendingCoords && (
              <Draggable>
                <div
                  style={{
                    position: "absolute",
                    top: pendingCoords.y - 20,
                    left: pendingCoords.x,
                    transform: "translate(-50%, -100%)",
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "10px",
                    zIndex: 2000,
                    minWidth: "280px",
                    maxWidth: "400px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                    cursor: "move",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {/* === Text + Label in one row === */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <TextField
                      label="Text"
                      type={typeForm.isPassword ? "password" : "text"}
                      value={typeForm.text}
                      onChange={(e) =>
                        setTypeForm((cur) => ({ ...cur, text: e.target.value }))
                      }
                      required
                      size="small"
                      autoFocus
                      fullWidth
                      style={{ flex: 1 }}
                    />

                    {typeForm.editable && (
                      <TextField
                        label="Label"
                        value={typeForm.label}
                        onChange={(e) =>
                          setTypeForm((cur) => ({ ...cur, label: e.target.value }))
                        }
                        required
                        error={!typeForm.label.trim()}
                        helperText={!typeForm.label.trim() ? "Label is required" : " "}
                        size="small"
                        fullWidth
                        style={{ flex: 1 }}
                        FormHelperTextProps={{
                          sx: {
                            fontSize: "0.5rem",
                            lineHeight: 1.2,
                            margin: 0,
                            minHeight: "14px",
                          },
                        }}
                      />
                    )}
                  </div>

                  {/* === Checkboxes + Action buttons === */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      alignItems: "center",
                      marginTop: "4px",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Left: checkboxes */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={typeForm.editable}
                            onChange={(e) =>
                              setTypeForm((cur) => ({
                                ...cur,
                                editable: e.target.checked,
                              }))
                            }
                            size="small"
                            sx={{ transform: "scale(0.7)", padding: "2px" }}
                          />
                        }
                        label={<span style={{ fontSize: "0.75rem" }}>Editable</span>}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={typeForm.isPassword}
                            onChange={(e) =>
                              setTypeForm((cur) => ({
                                ...cur,
                                isPassword: e.target.checked,
                              }))
                            }
                            size="small"
                            sx={{ transform: "scale(0.7)", padding: "2px" }}
                          />
                        }
                        label={<span style={{ fontSize: "0.75rem" }}>Password</span>}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={typeForm.storeValue}
                            onChange={(e) =>
                              setTypeForm((cur) => ({
                                ...cur,
                                storeValue: e.target.checked,
                              }))
                            }
                            size="small"
                            disabled={!typeForm.editable}
                            sx={{ transform: "scale(0.7)", padding: "2px" }}
                          />
                        }
                        label={<span style={{ fontSize: "0.75rem" }}>Store</span>}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={typeForm.pressEnter}
                            onChange={(e) =>
                              setTypeForm((cur) => ({
                                ...cur,
                                pressEnter: e.target.checked,
                              }))
                            }
                            size="small"
                            sx={{ transform: "scale(0.7)", padding: "2px" }}
                          />
                        }
                        label={<span style={{ fontSize: "0.75rem" }}>Enter</span>}
                      />
                    </div>

                    {/* Right: action buttons */}
                    <div style={{ display: "flex", gap: "6px" }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setShowTypeDialog(false);
                          setPendingCoords(null);
                        }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={async () => {
                          if (!pendingCoords) return;
                          if (typeForm.editable && !typeForm.label.trim()) {
                            alert("Label is required when Editable is checked.");
                            return;
                          }
                          await sendStep({
                            type: "TYPE",
                            coords: { x: pendingCoords.x, y: pendingCoords.y },
                            text: typeForm.text,
                            pressEnter: typeForm.pressEnter,
                            viewport,
                            waitAfterMs: 300,
                            timestamp: Date.now(),
                            label: typeForm.label || "",
                            isPassword: typeForm.isPassword,
                            storeValue: typeForm.storeValue,
                          });
                          setShowTypeDialog(false);
                          setPendingCoords(null);
                          setTypeForm({
                            text: "",
                            label: "",
                            pressEnter: true,
                            editable: false,
                            isPassword: false,
                            storeValue: true,
                          });
                        }}
                      >
                        <Check fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </Draggable>
            )}


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
        </>
      )}

      {showData && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
          <h4>Edit Replay Variables ({editedData.length})</h4>

          {editedData.length === 0 ? (
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
                {editedData.map((obj) => (
                  <tr key={obj.label}>
                    <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{obj.label}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>
                      <input
                        style={{ width: "100%" }}
                        type={obj.isPassword ? "password" : "text"} 
                        value={obj.text}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setEditedData((cur) => 
                            cur.map(item => item.label === obj.label ? { ...item, text: newValue } : item)
                          );
                          setUpdatedData((cur) => 
                            cur.map(item => item.label === obj.label ? { ...item, text: newValue } : item)
                          );
                        }}
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
                await updatePlaywrightScript(updatedData);
                setShowData(false);
              }}
            >
              Execute 
            </button>

            <button onClick={() => setShowData(false)}>Cancel</button>
          </div>
        </div>
      )}

    </div>
  );
}