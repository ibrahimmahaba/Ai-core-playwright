import React, { useRef, useState, useEffect, type JSX } from "react";
import { runPixel } from "@semoss/sdk";
import {
  Mouse as MouseIcon,
  Keyboard as KeyboardIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  AccessTime as AccessTimeIcon,
  Sync as SyncIcon,
} from "@mui/icons-material";
import { CircularProgress, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControlLabel, Checkbox, Autocomplete } from "@mui/material";

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

type ReplayPixelOutput = {
  isLastPage: boolean;
  inputs: VariableRecord[];
  screenshot: ScreenshotResponse
};


export default function RemoteRunner({ sessionId, metadata, insightId }: RemoteRunnerProps) {

  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [showData, setShowData] = React.useState(false);
  const [editedData, setEditedData] = React.useState<VariableRecord[]>([]);
  const [updatedData, setUpdatedData] = React.useState<VariableRecord[]>([]);
  const [scriptName, setScriptName] = useState("script-1");
  const [live, setLive] = useState(false);
  const [intervalMs] = useState(1000);
  const [allRecordings, setAllRecordings] = useState<string[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);


  useEffect(() => {
    if (!sessionId || !live) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try { await fetchScreenshot(); }
      finally {
        if (!cancelled && live) setTimeout(tick, intervalMs);
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [sessionId, live, intervalMs]);


  useEffect(() => {
    const fetchRecordings = async () => {
      let pixel = `ListPlaywrightScripts();`
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0];
      setAllRecordings(output as string[]);
    };
    fetchRecordings();
  }, []);  
  

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

  async function replayFromFile(optionalName?: string) {
    setLoading(true);
    try{
      let name: string | null;

      if (optionalName) {
        name = optionalName;
      } else {
        const input = window.prompt("Replay file (name in 'recordings' or absolute path):", scriptName);
        if (input === null) {
          return; 
        }
        name = input || scriptName;
      }
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

  async function editRecording() {
    if (!selectedRecording) {
      alert("Please select a recording first.");
      return;
    }

    const name = selectedRecording;

    // TODO: lama ados -> pixel call ReplayStep (sessionId = "", fileName = "", paramValues = []);
    // 1. display first screen -> set the shot -> logic from ReplayFile
    // 2. list of variables if exists -> set the list -> setShowData and update editedData and updatedData (logic from Update)

    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${name}");`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as {output : ReplayPixelOutput};

    setEditedData(output.inputs);
    setUpdatedData(output.inputs);
    setShowData(true);
    setScriptName(name);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
  }


  async function updatePlaywrightScript(currentDataParam?: VariableRecord[]) {
    const currentData = currentDataParam ?? updatedData;
  
    console.log(currentData);
    if (!currentData || currentData.length === 0) {
      alert("No variables provided!");
      return;
    }
  
    const input = window.prompt("Enter the new file name:", scriptName);
    if (input === null) {
      return;
    }
    const newName = input || scriptName; 
  
    // Build Variables from the array
    const Variables = currentData
      .map(v => `{ "${v.label}": "${v.text}" }`)
      .join(", ");
  
    // Filter metadata (title, description only)
    const metadataVariables = currentData
      .filter(v => v.label === "title" || v.label === "description")
      .map(v => `{ "${v.label}": "${v.text}" }`)
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

  async function startLiveReplay() {
    setLive(true);
  }
  
  async function handleNextStep(){

    let paramValues = {[editedData[0].label] : editedData[0].text}

    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", paramValues=[${JSON.stringify(paramValues)}]);`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as {output : ReplayPixelOutput};

    const newEditedData = editedData.slice(1);

  if (!newEditedData ||newEditedData.length === 0) {
    setEditedData(output.inputs);
    setUpdatedData(output.inputs);
  } else {
    setEditedData(newEditedData);
  }

  setShowData(true);
  setIsLastPage(output.isLastPage);
  setShot(output.screenshot);

  console.log(newEditedData); 
  }

  async function handleExecuteAll(){
    const result = updatedData.reduce<Record<string, string>>((acc, item) => {
      acc[item.label] = item.text;
      return acc;
    }, {});
    
    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", paramValues=[${JSON.stringify(result)}]);`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as {output : ReplayPixelOutput};


    setEditedData(output.inputs);
    setUpdatedData(output.inputs);
    setShowData(true);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
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


      <h2>Playwright Script Player App</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button onClick={() => replayFromFile()} >
          Replay From File
        </button>

        <Autocomplete
          options={allRecordings}
          value={selectedRecording}
          onChange={(_, newValue) => setSelectedRecording(newValue)}
          renderInput={(params) => (
            <TextField {...params} label="Select Recording" placeholder="Search recordings..." />
          )}
          sx={{ minWidth: 250 }}
        />

        <button onClick={editRecording}>
          Load Recording (Edit)
        </button>

        <button onClick={startLiveReplay}>
          Start Live Replay
        </button>
        <button onClick={() => setLive(false)} disabled={!live}>Stop Live</button>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4>Edit Replay Variables </h4>
        </div>

        {!editedData ||editedData.length === 0 ? (
          <div>No variables found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}>Label</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}>Value</th>
                <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 4 }}></th>
              </tr>
            </thead>
            <tbody>
              {editedData.map((obj, index) => (
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
                  {index === 0 && !isLastPage && (  
                    <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>
                      <button
                        style={{ padding: "4px 10px", borderRadius: 4, cursor: "pointer" }}
                        onClick={handleNextStep}
                      >
                        Execute →
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button
            onClick={handleExecuteAll}
          >
            {(!editedData || editedData.length === 0) ? "Next" : "Execute All"}
          </button>

          <button onClick={() => setShowData(false)}>Cancel</button>
        </div>
      </div>
    )}


      <Dialog open={showTypeDialog} onClose={() => setShowTypeDialog(false)}>
        <DialogTitle>Type Input</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 400 }}>
          <TextField
            label="Text"
            type={typeForm.isPassword ? "password" : "text"} 
            value={typeForm.text}
            onChange={(e) => setTypeForm((cur) => ({ ...cur, text: e.target.value }))}
            required
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
              helperText={
                !typeForm.label.trim()
                  ? "Label is required when Editable is checked"
                  : ""
              }
            />
          )}

          {showTypeDialog && (
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
                      setTypeForm((cur) => ({ ...cur, text: typeForm.text + value }));
                      setAnchorEl(null);
                    }}
                  >
                    {key}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={typeForm.editable}
                onChange={(e) => setTypeForm((cur) => ({ ...cur, editable: e.target.checked }))}
              />
            }
            label="Editable"
          />

        <FormControlLabel
          control={
            <Checkbox
              checked={typeForm.isPassword}
              onChange={(e) =>
                setTypeForm((cur) => ({
                  ...cur,
                  isPassword: e.target.checked,
                  storeValue: cur.storeValue
                }))
              }
            />
          }
          label="Password"
        />
          <FormControlLabel
            control={
              <Checkbox
                checked={typeForm.storeValue}
                onChange={(e) =>
                  setTypeForm((cur) => ({ ...cur, storeValue: e.target.checked }))
                }
                disabled={!typeForm.editable}   // disable if editable
              />
            }
            label="Store Value"
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
       

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTypeDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!pendingCoords) return;

              if (typeForm.editable && !typeForm.label.trim()) {
                alert("Label is required when Editable is checked.");
                return;
              }

              await sendStep({
                type: "TYPE",
                coords: pendingCoords,
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
              setTypeForm({ text: "", label: "", pressEnter: true, editable: false, isPassword: false, storeValue: true});
            }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

    </div>
  );
}