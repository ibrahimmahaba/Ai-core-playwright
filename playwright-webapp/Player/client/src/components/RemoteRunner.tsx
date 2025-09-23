import React, { useRef, useState, useEffect, type JSX } from "react";
import { runPixel } from "@semoss/sdk";
import {
  Mouse as MouseIcon,
  Keyboard as KeyboardIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  AccessTime as AccessTimeIcon,
  Sync as SyncIcon,
  CropFree as CropIcon, 
} from "@mui/icons-material";
import { CircularProgress, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button,
   TextField, FormControlLabel, Checkbox, Autocomplete, styled } from "@mui/material";
import Draggable from "react-draggable";
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css'; 

type CropArea = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};
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

type Action = | { TYPE: { label: string; text: string; isPassword?: boolean} } 
| { CLICK: { coords: Coords } } 
| { SCROLL: { deltaY: number } } 
| { WAIT: number } // waitAftermilliseconds 
| { NAVIGATE: string;}; // url

type RemoteRunnerProps = {
  sessionId: string; 
  metadata: Record<string, string>; 
  insightId: string;
}

type ReplayPixelOutput = {
  isLastPage: boolean;
  actions: Action[];
  screenshot: ScreenshotResponse
};


export default function RemoteRunner({ sessionId, metadata, insightId }: RemoteRunnerProps) {

  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [showData, setShowData] = React.useState(false);
  const [editedData, setEditedData] = React.useState<Action[]>([]);
  const [updatedData, setUpdatedData] = React.useState<Action[]>([]);
  const [scriptName, setScriptName] = useState("script-1");
  const [live, setLive] = useState(false);
  const [intervalMs] = useState(1000);
  const [allRecordings, setAllRecordings] = useState<string[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [lastPage, setIsLastPage] = useState(false);
  const [highlight, setHighlight] = useState<Coords | null>(null);
  const [visionPopup, setVisionPopup] = useState<{x: number; y: number; query: string; response: string | null; } | null>(null);
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [crop, setCrop] = useState<Crop>();

  const showHighlight = (x: number, y: number) => {
    setHighlight({ x, y });
    setTimeout(() => setHighlight(null), 4000); // Remove highlight after 2 seconds
  }


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

  type Mode = "click" | "type" | "scroll" | "crop";
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
    setLoading(true);
    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${name}", executeAll=false);`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as {output : ReplayPixelOutput};

    setLoading(false);
    setEditedData(output.actions);
    setUpdatedData(output.actions);
    setShowData(true);
    setScriptName(name);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
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

    const nextAction = editedData[0];
    let pixel;
    if ("TYPE" in nextAction) {
      const {label, text} = nextAction.TYPE;
      let paramValues = {[label]: text};
      pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", paramValues=[${JSON.stringify(paramValues)}], executeAll=false);`;
    } else {
      pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", executeAll=false);`;
    }
    setLoading(true);
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as {output : ReplayPixelOutput};

    const newEditedData = editedData.slice(1);

  if (!newEditedData ||newEditedData.length === 0) {
    setEditedData(output.actions);
    setUpdatedData(output.actions);
  } else {
    setEditedData(newEditedData);
  }
  setLoading(false);
  setUpdatedData(output.actions);
  setShowData(true);
  setIsLastPage(output.isLastPage);
  setShot(output.screenshot);

  console.log(newEditedData); 
  }

  async function handleExecuteAll(){
    setLoading(true);
    const result = updatedData.reduce<Record<string, string>[]>((acc, action) => {
      if ("TYPE" in action) {
        acc.push({[action.TYPE.label]: action.TYPE.text});
      }
      return acc;
    }, []);
    
    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", executeAll=true, paramValues=${JSON.stringify(result)});`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as {output : ReplayPixelOutput};
    
    setLoading(false);
    setEditedData(output.actions);
    setUpdatedData(output.actions);
    setShowData(true);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
  }

  // async function handleLLMAnalysis(engineId: string | null) {
  //   if (!visionPopup || !visionPopup.query.trim() || !currentCropArea) return;
  //   
    
  //   try {
  //     const pixel = `ImageContext(
  //       sessionId="${sessionId}",
  //       engine="${engineId ? engineId : '029a1323-db79-415c-be3e-3945438b0808'}", 
  //       paramValues=[{
  //         "startX": ${cropArea.startX}, 
  //         "startY": ${cropArea.startY}, 
  //         "endX": ${cropArea.endX}, 
  //         "endY": ${cropArea.endY},
  //         "userPrompt": "${userPrompt}"
  //       }]
  //     )`;
      
  //     const res = await runPixel(pixel, insightId);
  //     const output = res.pixelReturn[0].output as { response: string };
      
  //    
        //setVisionPopup({ ...visionPopup, response: resp });

      
  //   } catch (err) {
  //     console.error("LLM Vision error:", err);
  //   }
  // }
  

  async function handleLLMAnalysis() {
    if (!visionPopup || !visionPopup.query.trim() || !currentCropArea) return;
  
    try {
      const cropPixel = `Screenshot(
        sessionId="${sessionId}", 
        paramValues=[{
          "startX": ${currentCropArea.startX}, 
          "startY": ${currentCropArea.startY}, 
          "endX": ${currentCropArea.endX}, 
          "endY": ${currentCropArea.endY}
        }]
      )`;
  
      const cropRes = await runPixel(cropPixel, insightId);
      const croppedImage = cropRes.pixelReturn[0].output as ScreenshotResponse;
      const resp = await callVisionAPI(visionPopup.query, croppedImage.base64Png);
  
      setVisionPopup({ ...visionPopup, response: resp });
    } catch (err) {
      console.error("Vision analysis error:", err);
      alert("Error: " + err);
    }
  }
  
  function handleVisionPopup(cropArea: CropArea) { 
    const dialogX = Math.min(cropArea.endX + 20, (shot?.width ?? 800) - 300);
    const dialogY = cropArea.startY;
    setCurrentCropArea(cropArea);
    
    setVisionPopup({
      x: dialogX, 
      y: dialogY,  
      query: "Describe what you see",
      response: null,
    });
  }
  
  async function callVisionAPI(query: string, base64Image: string): Promise<string> {
    const AUTH_TOKEN = "ZjlkMWRkNWUtY2M0Yy00MjUyLWE1ZDQtNDcxMzRmZjRmYWQxOjZjOThjNDMwLWZmMGItNDIzZC05ZmE2LTg0ZTE2OTA3ZjdhZQ==";
    const ENGINE_ID = "4acbe913-df40-4ac0-b28a-daa5ad91b172";
    
    const expression = `Vision(engine="${ENGINE_ID}", command = "${query}", image="data:image/png;base64,${base64Image}")`;
    const encodedExpression = encodeURIComponent(expression);
    const requestBody = `expression=${encodedExpression}`;
    
    const response = await fetch("https://workshop.cfg.deloitte.com/Monolith/api/engine/runPixel", {
      method: "POST",
      headers: {
        "authorization": `Basic ${AUTH_TOKEN}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: requestBody
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.pixelReturn[0].output.response || "No response received";
  }
  
  const StyledButton = styled(Button)(({ theme }) => ({
    color: theme.palette.text.primary,
    border: `0px solid ${theme.palette.divider}`,
  }));
  
  const StyledPrimaryButton = styled(Button)(({ theme }) => ({
    color: theme.palette.common.white,
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
    borderRadius: "8px"
  }));
  
  const StyledDangerButton = styled(Button)(({ theme }) => ({
    color: theme.palette.common.white,
    backgroundColor: theme.palette.error.main,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
    borderRadius: "8px"
  }));
  

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
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" },
          { m: "crop", icon: <CropIcon />, label: "Add Context" }


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
                } else if (m == "crop") {
                  setMode("crop");
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
          <div style={{ position: "relative", display: "inline-block" }}>
          {mode === "crop" ? (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => {
                  if (c.width && c.height) {
                    const cropArea: CropArea = {
                      startX: c.x,
                      startY: c.y,
                      endX: c.x + c.width,
                      endY: c.y + c.height,
                    };
                    handleVisionPopup(cropArea);
                    //setMode("click");
                    //setCrop(undefined);
                  }
                }}
                aspect={undefined}
              >
                <img
                  ref={imgRef}
                  src={`data:image/png;base64,${shot.base64Png}`}
                  alt="remote"
                  style={{
                    border: "1px solid #ccc",
                    maxWidth: "100%",
                  }}
                  onLoad={() => setLoading(false)}
                />
              </ReactCrop>
            ) : (
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
            )}

            {highlight && (
              <div
                style={{
                  position: "absolute",
                  top: (highlight.y * imgRef.current!.height) / shot.height - 15,
                  left: (highlight.x * imgRef.current!.width) / shot.width - 15,
                  width: 30,
                  height: 30,
                  border: "3px solid red",
                  borderRadius: "50%",
                  pointerEvents: "none",
                  boxSizing: "border-box",
                  animation: "pulse 1s infinite",
                }}
              ></div>)}
              

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

          {visionPopup && (
            <Draggable>
              <div style={{
                position: "absolute",
                top: visionPopup.y,
                left: visionPopup.x,
                transform: "translate(-50%, -100%)",
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "12px",
                zIndex: 2000,
                width: "320px",
                maxHeight: "400px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                cursor: "move",
              }}>
                {!visionPopup.response ? (
                  <>
                    <TextField
                      label="Ask about this area"
                      size="small"
                      fullWidth
                      value={visionPopup.query}
                      onChange={(e) =>
                        setVisionPopup({ ...visionPopup, query: e.target.value })
                      }
                    />
                    <StyledPrimaryButton
                      onClick={handleLLMAnalysis}
                      fullWidth
                    >
                      Submit
                    </StyledPrimaryButton>
                  </>
                ) : (
                  <>
                    <div style={{
                      fontSize: "16px",
                      background: "#f8f9fa",
                      padding: "12px",
                      borderRadius: "4px",
                      color: "#333",
                      maxHeight: "250px",
                      overflowY: "auto",
                      whiteSpace: "pre-wrap"
                    }}>
                      {visionPopup.response}
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <StyledButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Close
                      </StyledButton>
                      <StyledPrimaryButton onClick={() => {
                        setVisionPopup(null);
                        setCurrentCropArea(null);
                        setMode("click");
                        setCrop(undefined);
                      }}>
                        Add to Context
                      </StyledPrimaryButton>
                      <StyledDangerButton onClick={async () => {
                        setVisionPopup({ ...visionPopup, response: null });
                      }}>
                        Retry
                      </StyledDangerButton>
                    </div>
                  </>
                )}
              </div>
            </Draggable>
          )}
          </div>
        </>
      )}

    {showData && !lastPage && (
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
                  {editedData.map((action, index) => {
                    const type = Object.keys(action)[0] as keyof Action;
                    const details = action[type] as any;

                    switch (type) {
                      case "TYPE":
                        return (
                          <tr key={index}>
                            <td>{details.label}</td>
                            <td>
                              <input
                                style={{ width: "100%" }}
                                type={details.isPassword ? "password" : "text"}
                                value={details.text}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setEditedData((cur) =>
                                    cur.map((item, i) =>
                                      i === index
                                        ? { TYPE: { ...details, text: newValue } }
                                        : item
                                    )
                                  );
                                }}
                              />
                            </td>
                            {index === 0 && (
                              <td>
                                <button onClick={handleNextStep}>Execute →</button>
                              </td>
                            )}
                          </tr>
                        );

                      case "CLICK":
                        return (
                          <tr key={index}>
                            <td>Click</td>
                            <td>
                              ({details.x}, {details.y})
                              <button onClick={() => showHighlight(details.x, details.y)}>
                                ℹ️
                              </button>
                            </td>
                            {index === 0 && (
                              <td>
                                <button onClick={handleNextStep}>Execute →</button>
                              </td>
                            )}
                          </tr>
                        );

                      case "NAVIGATE":
                        return (
                          <tr key={index}>
                            <td>Navigate</td>
                            <td>{details.url}</td>
                            {index === 0 && (
                              <td>
                                <button onClick={handleNextStep}>Execute →</button>
                              </td>
                            )}
                          </tr>
                        );

                      case "SCROLL":
                        return (
                          <tr key={index}>
                            <td>Scroll</td>
                            <td>DeltaY: {details.deltaY}</td>
                            {index === 0 && (
                              <td>
                                <button onClick={handleNextStep}>Execute →</button>
                              </td>
                            )}
                          </tr>
                        );

                      case "WAIT": 
                        return (
                          <tr key={index}>
                            <td>Wait</td>
                            <td>{details as number / 1000} sec</td>
                            {index === 0 && (
                              <td>
                                <button onClick={handleNextStep}>Execute →</button>
                              </td>
                            )}
                          </tr>
                        );

                      default:
                        return null;
                    }
                  })}
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