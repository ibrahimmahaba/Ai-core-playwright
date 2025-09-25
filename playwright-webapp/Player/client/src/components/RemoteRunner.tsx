import React, { useRef, useState, useEffect, type JSX } from "react";
import { runPixel } from "@semoss/sdk";
import {
  Mouse as MouseIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  AccessTime as AccessTimeIcon,
  Sync as SyncIcon,
  CropFree as CropIcon, 
} from "@mui/icons-material";
import {
  CircularProgress, Button,
  TextField, Autocomplete, styled
} from "@mui/material";
import Draggable from "react-draggable";
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type CropArea = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

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

type Action = | { TYPE: { label: string; text: string; isPassword?: boolean; coords?: Coords; probe?: Probe; } }
  | { CLICK: { coords: Coords } }
  | { SCROLL: { deltaY: number } }
  | { WAIT: number } // waitAftermilliseconds 
  | { NAVIGATE: string; }; // url

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


export default function RemoteRunner({ sessionId, insightId }: RemoteRunnerProps) {

  const [loading, setLoading] = useState(false);
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
  const [overlay, setOverlay] = useState<{
    kind: "input" | "confirm";
    probe: Probe;
    draftValue?: string;
    draftLabel?: string | null;
  } | null>(null);
  const [visionPopup, setVisionPopup] = useState<{ x: number; y: number; query: string; response: string | null; } | null>(null);
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [crop, setCrop] = useState<Crop>();
  //const [overlayKey, setOverlayKey] = useState(0);


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

  useEffect(() => {
    // Auto-show input overlay for TYPE steps
    if (editedData && editedData.length > 0 && !overlay && !loading && showData && shot) {
      setOverlayForType();
    }
  }, [editedData, overlay, loading, showData, shot]);


  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  function setOverlayForType() {
    const nextAction = editedData[0];
    if ("TYPE" in nextAction) {
      const typeAction = nextAction.TYPE;
      // Use probe data if available from server response
      const probe: Probe = typeAction.probe || {
        tag: "input",
        type: typeAction.isPassword ? "password" : "text",
        role: null,
        selector: null,
        placeholder: null,
        labelText: typeAction.label,
        value: typeAction.text,
        href: null,
        contentEditable: false,
        rect: typeAction.coords ? {
          x: typeAction.coords.x - 100,
          y: typeAction.coords.y - 15,
          width: 200,
          height: 30
        } : { x: 0, y: 0, width: 200, height: 30 },
        metrics: null,
        styles: null,
        placeholderStyle: null,
        attrs: null,
        isTextControl: true
      };
      setOverlay({
        kind: "input",
        probe: {...probe, rect : {...probe.rect} }, 
        draftValue: typeAction.text,
        draftLabel: typeAction.label
      });
    }
  }

  async function sendStep(step: Step) {
    if (!sessionId) return;

    setLoading(true);
    try {
      let shouldStore = step.type == "TYPE" && step.storeValue;
      let pixel = `Step ( sessionId = "${sessionId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
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

  async function probeAt(pendingCoords: Coords | null) {
    if (!sessionId) return;
    if (!pendingCoords) alert("Invalid Coordinates");

    let pixel = `ProbeElement (sessionId = "${sessionId}" , coords = "${pendingCoords?.x}, ${pendingCoords?.y}");`
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: Probe };
    console.log(output)
    return output;

  }

  type Mode = "click" | "scroll" | "crop";
  const [mode, setMode] = useState<Mode>("click");

  async function handleClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);
    const p = await probeAt(coords);
    if (!p) return;

    const isTextField =
      (p.tag === "input" && p.type && !["button", "submit", "checkbox", "radio", "file"].includes(p.type)) ||
      p.tag === "textarea" ||
      p.contentEditable;

    if (isTextField) {
      setOverlay({ kind: "input", probe: p, draftValue: p.value ?? "", draftLabel: p.labelText ?? "" });
    } else if (p.tag === "a" && p.href && p.href.startsWith("http")) {
      await sendStep({
        type: "NAVIGATE",
        viewport,
        waitAfterMs: 300,
        timestamp: Date.now(),
        url: p.href
      });
    } else {
      await sendStep({
        type: "CLICK",
        coords,
        viewport,
        waitAfterMs: 300,
        timestamp: Date.now()
      });
    }
  }

  async function replayFromFile(optionalName?: string) {
    setLoading(true);
    try {
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
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

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
      if (snap) {
        setShot(snap);
        
        // If there's an overlay, re-probe to get updated coordinates
        if (overlay) {
          const oldRect = overlay.probe.rect;
          const updatedProbe = await probeAt({ x: Math.round(oldRect.x), y: Math.round(oldRect.y) });
          if (updatedProbe) {
            setOverlay(prev => prev ? { ...prev, probe: updatedProbe } : null);
          }
        }
      }   
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
  async function handleNextStep() {
    const nextAction = editedData[0];
    let pixel;
    if ("TYPE" in nextAction) {
      // Use the draftValue and draftLabel from overlay if available
      if (overlay && overlay.draftValue !== undefined) {
        nextAction.TYPE.text = overlay.draftValue;
      }
      const { label, text } = nextAction.TYPE;
      let paramValues = { [label]: text };
      pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", paramValues=[${JSON.stringify(paramValues)}], executeAll=false);`;
      setOverlay(null);
    } else {
      pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", executeAll=false);`;
    }
    setLoading(true);
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

    // Update editedData with the new data that includes coords and probe
    const newEditedData = editedData.slice(1);
    if (!newEditedData || newEditedData.length === 0) {
      setEditedData(output.actions);
      setUpdatedData(output.actions);

    } else {
      // Merge the server response data (coords, probe) with existing editedData
      const updatedEditedData = newEditedData.map((action, index) => {
        if (output.actions[index]) {
          return { ...action, ...output.actions[index] };
        }
        return action;
      });
      setEditedData(updatedEditedData);
    }
    setLoading(false);
    setUpdatedData(output.actions);
    setShowData(true);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
  }


  async function handleExecuteAll() {
    setLoading(true);
    const result = updatedData.reduce<Record<string, string>[]>((acc, action) => {
      if ("TYPE" in action) {
        acc.push({ [action.TYPE.label]: action.TYPE.text });
      }
      return acc;
    }, []);

    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", executeAll=true, paramValues=${JSON.stringify(result)});`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

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
    imgRef: React.RefObject<HTMLImageElement | null>;
  }) {
    const imgEl = imgRef.current;
    if (!imgEl) return null;

    const { probe } = ol;
    const box = pageRectToImageCss(probe.rect, imgEl, shot);
  
  
    // Wrapper strictly matches the element’s (scaled) rect

    // Wrapper strictly matches the element’s (scaled) rect
    const wrapperStyle: React.CSSProperties = {
      position: "absolute",
      left: box.left,
      top: box.top,
      width: Math.max(box.width, 120),
      height: Math.max(box.height, 16),
      zIndex: 1000,
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
      const isTextarea = probe.tag === "textarea";
      const commonProps = {
        autoFocus: true,
        className: placeholderClass,
        placeholder: probe.placeholder ?? "",
        defaultValue: ol.draftValue ?? probe.value ?? "",
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          if (e.key === "Enter" && !isTextarea) { e.preventDefault(); onSubmit(); }
          if (e.key === "Escape") { onCancel(); }
       },
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          //set editedData draft value
          ol.draftValue = e.target.value;
        },
        style: controlStyle,
      } as const;

      return (
        <div style={wrapperStyle}>
          <style dangerouslySetInnerHTML={{ __html: placeholderCss }} />
          {isTextarea ? (
            <textarea {...commonProps} />
          ) : (
            <input {...commonProps} type={probe.type ?? "text"}   />
          )}
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
                    mode === "scroll"
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

            {overlay && shot && (
              <>
                <Overlay
                  ol={overlay}
                  shot={shot}
                  imgRef={imgRef}
                  onCancel={() => setOverlay(null)}
                  onSubmit={async () => {
                    await handleNextStep();
                    setOverlay(null);
                  }}
                />
              </>
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

          {!editedData || editedData.length === 0 ? (
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
                          <td style={{textAlign: "start"}} >{details.label}</td>
                          <td></td>
                          {index === 0 && (
                            <td>
                              <button onClick={handleNextStep}>Execute →</button>
                            </td>
                          )}
                        </tr>
                      );

                    case "CLICK":
                      return (
                        <tr key={index} style={{textAlign: "start"}}>
                          <td >Click</td>
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
                        <tr key={index} style={{textAlign: "start"}}>
                          <td >Navigate</td>
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
                        <tr key={index} style={{textAlign: "start"}}>
                          <td >Scroll</td>
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
                        <tr key={index} style={{textAlign: "start"}}>
                          <td >Wait</td>
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
    </div>
  );
}