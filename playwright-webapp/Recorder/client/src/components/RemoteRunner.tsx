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

type ElementMetrics = {
  offsetWidth: number;
  offsetHeight: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
};

type CSSMap = Record<string, string>;

type ProbeRect = { x: number; y: number; width: number; height: number };

type Probe = {
  tag: string | null;
  type: string | null;
  role: string | null;
  selector: string | null;
  placeholder: string | null;
  labelText: string | null;
  value: string | null;
  href: string | null;
  contentEditable: boolean;
  rect: ProbeRect;

  metrics?: ElementMetrics | null;
  styles?: CSSMap | null;             
  placeholderStyle?: CSSMap | null;   
  attrs?: Record<string, string> | null;
  isTextControl?: boolean;
};

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
  const [overlay, setOverlay] = useState<{
    kind: "input" | "confirm";
    probe: Probe;
    // fields for the inline editor
    draftValue?: string;
    draftLabel?: string | null;
  } | null>(null);

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

  type Mode = "click" | "type" | "scroll" | "confirm";
  const [mode, setMode] = useState<Mode>("click");



  const [typeForm] = useState({
    text: "",
    label: "",
    pressEnter: false,
    editable: false,
    isPassword: false,  
    storeValue: true,    
  });

  async function probeAt(pendingCoords: Coords | null) {
    if (!sessionId) return ;
    if (!pendingCoords) alert("Invalid Coordinates");

    let pixel = `ProbeElement (sessionId = "${sessionId}" , coords = "${pendingCoords?.x}, ${pendingCoords?.y}");`
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: Probe };
    console.log(output)
    return output;

  }

  function Overlay({
    ol,
    shot,
    onCancel,
    onSubmit,
    imgRef,
  }: {
    ol: NonNullable<typeof overlay>;
    shot: ScreenshotResponse;
    onCancel: () => void;
    onSubmit: (value?: string, label?: string | null) => void;
    imgRef: React.RefObject<HTMLImageElement | null>; // 👈 fix here
  }) {
    const imgEl = imgRef.current;
    if (!imgEl) return null;
  
    const { probe } = ol;
    const box = pageRectToImageCss(probe.rect, imgEl, shot);
  
    // Wrapper strictly matches the element’s (scaled) rect
    const wrapperStyle: React.CSSProperties = {
      position: "absolute",
      left: box.left,
      top: box.top,
      width: Math.max(box.width, 120),
      height: Math.max(box.height, 16),
      zIndex: 1000,
      // Transparent wrapper; let the inner control carry the visual style
      background: "transparent",
      pointerEvents: "auto"
    };
  
    // Build inner control style from computed CSS
    const controlStyle = buildInputStyleFromProbe(probe);
  
    // Placeholder styling via dynamic class
    const placeholderClass = React.useMemo(
      () => `ph-${Math.random().toString(36).slice(2)}`,
      []
    );
    const ph = probe.placeholderStyle || {};
    const placeholderCss = `
      .${placeholderClass}::placeholder {
        ${ph.color ? `color: ${ph.color} !important;` : ""}
        ${ph.opacity ? `opacity: ${ph.opacity} !important;` : ""}
        ${ph.fontStyle ? `font-style: ${ph.fontStyle} !important;` : ""}
        ${ph.fontWeight ? `font-weight: ${ph.fontWeight} !important;` : ""}
        ${ph.fontSize ? `font-size: ${ph.fontSize} !important;` : ""}
        ${ph.fontFamily ? `font-family: ${ph.fontFamily} !important;` : ""}
        ${ph.letterSpacing ? `letter-spacing: ${ph.letterSpacing} !important;` : ""}
      }
    `;
  
    if (ol.kind === "input") {
      // Decide input vs textarea
      const isTextarea = probe.tag === "textarea";
      const commonProps = {
        autoFocus: true,
        className: placeholderClass,
        placeholder: probe.placeholder ?? "",
        defaultValue: ol.draftValue ?? probe.value ?? "",
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          if (e.key === "Enter" && !isTextarea) {
            onSubmit((e.target as HTMLInputElement | HTMLTextAreaElement).value, ol.draftLabel ?? null);
          }
          if (e.key === "Escape") onCancel();
        },
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          ol.draftValue = e.target.value;
        },
        style: controlStyle,
      } as const;
  
      return (
        <div style={wrapperStyle}>
          {/* placeholder CSS injector */}
          <style dangerouslySetInnerHTML={{ __html: placeholderCss }} />
          {isTextarea ? (
            <textarea {...commonProps} />
          ) : (
            <input {...commonProps} type={probe.type ?? "text"} />
          )}
  
           <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              style={{ flex: 1, padding: 6, border: "1px solid #eee", borderRadius: 6 }}
              placeholder="Optional label (e.g., username)"
              defaultValue={ol.draftLabel ?? probe.labelText ?? ""}
              onChange={(e) => (ol.draftLabel = e.target.value)}
            />

              <FormControlLabel
                  control={
                    <Checkbox
                      defaultChecked
                      onChange={(e) => {
                        (ol as any).draftStoreValue = e.target.checked;
                      }}
                    />
                  }
                  label="Store Value"
                  title="Store Value"
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontSize: "0.7rem", // smaller text
                    },
                  }}
                />


            <IconButton
              size="small"
              onClick={() =>
                onSubmit(ol.draftValue ?? probe.value ?? "", ol.draftLabel ?? probe.labelText ?? null)
              }
              color="success"
            >
              <Check fontSize="small" />
            </IconButton>

            <IconButton size="small" onClick={onCancel} color="error">
              <Close fontSize="small" />
            </IconButton>
          </div>
        </div>
      );
    }
  
    // Confirm click overlay (unchanged)
    return (
      <div style={{
        position: "absolute",
        left: box.left,
        top: Math.max(0, box.top - 8),
        width: 160,
        zIndex: 1000,
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 8,
        boxShadow: "0 6px 16px rgba(0,0,0,0.2)"
      }}>
        <div style={{ marginBottom: 6 }}>Click this?</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => onSubmit(undefined, ol.draftLabel ?? null)}>✔ Yes</button>
          <button onClick={onCancel}>✖ No</button>
        </div>
        <input
          style={{ marginTop: 6, width: "100%", padding: 6, border: "1px solid #eee", borderRadius: 6 }}
          placeholder="Optional label"
          defaultValue={ol.draftLabel ?? ""}
          onChange={(e) => (ol.draftLabel = e.target.value)}
        />
      </div>
    );
  }

  function pageRectToImageCss(rect: ProbeRect, imgEl: HTMLImageElement, shot: ScreenshotResponse) {
    const ib = imgEl.getBoundingClientRect();
    const sx = ib.width / shot.width;
    const sy = ib.height / shot.height;
    return {
      left: rect.x * sx,
      top: rect.y * sy,
      width: rect.width * sx,
      height: rect.height * sy
    };
  }

  function buildInputStyleFromProbe(p: Probe): React.CSSProperties {
    const s = p.styles || {};
    // Keep values as strings (e.g., "12px", "rgb(...)")
    const st: React.CSSProperties = {
      // box model
      boxSizing: (s.boxSizing as any) || "border-box",
      paddingTop: s.paddingTop, paddingRight: s.paddingRight,
      paddingBottom: s.paddingBottom, paddingLeft: s.paddingLeft,
  
      borderTopWidth: s.borderTopWidth, borderRightWidth: s.borderRightWidth,
      borderBottomWidth: s.borderBottomWidth, borderLeftWidth: s.borderLeftWidth,
      borderTopStyle: s.borderTopStyle as any, borderRightStyle: s.borderRightStyle as any,
      borderBottomStyle: s.borderBottomStyle as any, borderLeftStyle: s.borderLeftStyle as any,
      borderTopColor: s.borderTopColor, borderRightColor: s.borderRightColor,
      borderBottomColor: s.borderBottomColor, borderLeftColor: s.borderLeftColor,
  
      borderTopLeftRadius: s.borderTopLeftRadius, borderTopRightRadius: s.borderTopRightRadius,
      borderBottomRightRadius: s.borderBottomRightRadius, borderBottomLeftRadius: s.borderBottomLeftRadius,
  
      // visual
      color: s.color,
      backgroundColor: s.backgroundColor,
      backgroundImage: s.backgroundImage,      // often 'none'
      backgroundClip: s.backgroundClip as any, // e.g., 'padding-box'
      outlineWidth: s.outlineWidth,
      outlineStyle: s.outlineStyle as any,
      outlineColor: s.outlineColor,
      outlineOffset: s.outlineOffset,
      boxShadow: s.boxShadow,
      textShadow: s.textShadow,
  
      // typography
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight as any,
      fontStyle: s.fontStyle as any,
      fontStretch: s.fontStretch as any,
      fontVariant: s.fontVariant as any,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textAlign: s.textAlign as any,
      textTransform: s.textTransform as any,
      textDecorationLine: s.textDecorationLine as any,
      textDecorationStyle: s.textDecorationStyle as any,
      textDecorationColor: s.textDecorationColor,
  
      // caret & overflow
      // (caretColor works on inputs/textareas)
      caretColor: s.caretColor as any,
      overflow: s.overflow as any,
      overflowX: s.overflowX as any,
      overflowY: s.overflowY as any,
  
      // ensure it fills the overlay box
      width: "100%",
      height: "100%",
    };
  
    // Safety defaults for tiny targets
    if (!st.paddingTop) st.paddingTop = "6px";
    if (!st.paddingBottom) st.paddingBottom = "6px";
    if (!st.paddingLeft) st.paddingLeft = "8px";
    if (!st.paddingRight) st.paddingRight = "8px";
  
    // If the element has zero border style/width, ensure something predictable
    // (Otherwise browsers may treat undefined as medium)
    if (!s.borderTopStyle && !s.borderTopWidth) {
      st.border = "1px solid rgba(0,0,0,0.15)";
    }
  
    return st;
  }


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
      const p = await probeAt(coords);
      if (!p) return;
      const isTextField =
        !!p.isTextControl || 
        (p.tag === "input" && p.type && !["button","submit","checkbox","radio","file"].includes(p.type)) ||
        p.tag === "textarea" ||
        p.contentEditable;

      if (!isTextField) {
        console.warn("Clicked element is not a text field; showing input anyway");
      }
      setOverlay({ kind: "input", probe: p, draftValue: p.value ?? "", draftLabel: p.labelText ?? "" });
    }
    else if (mode === "confirm") {
      const p = await probeAt(coords);
      if (!p) return;
      setOverlay({ kind: "confirm", probe: p });
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
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" },

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
                } else if (m === "cancel") {
                  setMode("click");
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
            

            {overlay && shot && (
              <>
                {console.log(Overlay)}
                <Overlay
                  ol={overlay}
                  shot={shot}
                   imgRef={imgRef}
                  onCancel={() => setOverlay(null)}
                  onSubmit={async (value, label) => {
                    const { probe } = overlay!;
                    const draftStoreValue = (overlay as any).draftStoreValue ?? true;
                    const coords = {
                      x: Math.round(probe.rect.x + probe.rect.width / 2),
                      y: Math.round(probe.rect.y + probe.rect.height / 2)
                    };

                    if (overlay!.kind === "input") {
                      await sendStep({
                        type: "TYPE",
                        coords,
                        text: draftStoreValue ? value ?? "" : "",
                        label: label ?? null,
                        pressEnter: false,
                        isPassword: probe.type === "password",
                        storeValue: draftStoreValue,   
                        viewport,
                        waitAfterMs: 300,
                        timestamp: Date.now()
                      } as Step);
                    } else {
                      await sendStep({
                        type: "CLICK",
                        coords,
                        viewport,
                        waitAfterMs: 300,
                        timestamp: Date.now()
                      } as Step);
                    }
                    setOverlay(null);
                  }}
                />
              </>
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
          <h4>Edit Replay Variables </h4>

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


