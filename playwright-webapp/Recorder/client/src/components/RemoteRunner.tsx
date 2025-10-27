import React, { useRef, useState, useEffect, useMemo } from "react"; // added useMemo
import { runPixel } from "@semoss/sdk";
import { CircularProgress, FormControlLabel, Checkbox } from "@mui/material";
import { IconButton } from "@mui/material";
import { Check, Close } from "@mui/icons-material";
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Toolbar from "./Toolbar/Toolbar";
import type { Coords, CropArea, Probe, ProbeRect, RemoteRunnerProps, ScreenshotResponse, Step, Viewport } from "../types";
import Header from "./Header/Header";
import { useSendStep } from "../hooks/useSendStep";
import { preferSelectorFromProbe } from "../hooks/usePreferSelector";
import VisionPopup from "./VisionPopup/VisionPopup";
import './remote-runner.css';


export default function RemoteRunner({ sessionId, insightId }: RemoteRunnerProps)  {

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [overlay, setOverlay] = useState<{
    kind: "input" | "confirm";
    probe: Probe;
    draftValue?: string;
    draftLabel?: string | null;
    draftStoreValue?: boolean; // added to avoid any cast
  } | null>(null);
  const [crop, setCrop] = useState<Crop>();
 const [visionPopup, setVisionPopup] = useState<{x: number; y: number; query: string; response: string | null; } | null>(null);
 const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
 const [mode, setMode] = useState<string>("click");
 const prevShotBase64Ref = useRef<string>("");


  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  // normalize screenshot utility
  function normalizeShot(raw: unknown): ScreenshotResponse | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Record<string, unknown>;
    const base64 = (r['base64Png'] || r['base64'] || r['imageBase64'] || r['pngBase64'] || r['data'] || "") as string;
    const width = (r['width'] || r['w'] || 1280) as number;
    const height = (r['height'] || r['h'] || 800) as number;
    const dpr = (r['deviceScaleFactor'] || r['dpr'] || 1) as number;
    if (!base64 || typeof base64 !== "string") return undefined;
    return { base64Png: base64, width, height, deviceScaleFactor: dpr };
  }

  // live polling for latest screenshot every second
  useEffect(() => {
    if (!sessionId) return; // wait until session established
    let active = true;
    const poll = async () => {
      try {
        const pixel = `Screenshot ( sessionId = "${sessionId}" )`;
        const res = await runPixel(pixel, insightId);
        const { output } = res.pixelReturn[0];
        const snap = normalizeShot(output);
        if (active && snap && snap.base64Png !== prevShotBase64Ref.current) {
          prevShotBase64Ref.current = snap.base64Png;
          setShot(snap);
        }
      } catch (e) {
        console.error("Live replay screenshot error", e);
      }
    };
    // initial fetch
    poll();
    const id = setInterval(poll, 1000); // 1s interval
    return () => { active = false; clearInterval(id); };
  }, [sessionId, insightId]);

  const { sendStep } = useSendStep({
    insightId : insightId,
    sessionId : sessionId,
    shot: shot,
    setShot: setShot,
    steps: steps,
    setSteps: setSteps,
    setLoading: setLoading
});
  // async function sendStep(step: Step) {
  //   if (!sessionId) return;

  //   let shouldStore = step.type == "TYPE" && step.storeValue;

  //   setLoading(true);
  //   try {
  //     let pixel = `Step ( sessionId = "${sessionId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
  //     const res = await runPixel(pixel, insightId);

  //     const { output } = res.pixelReturn[0];

  //     const data: ScreenshotResponse = output as ScreenshotResponse;
  //     setShot(data);
  //     setSteps(prev => [...prev, step]);
  //   } finally {
  //     setLoading(false);
  //   }
  // }
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
    if (!sessionId) return ;
    if (!pendingCoords) { alert("Invalid Coordinates"); return; }

    const pixel = `ProbeElement (sessionId = "${sessionId}" , coords = "${pendingCoords.x}, ${pendingCoords.y}");`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: Probe };
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
    imgRef: React.RefObject<HTMLImageElement | null>;
  }) {
    const imgEl = imgRef.current;
    // Placeholder styling hook must run unconditionally
    const placeholderClass = useMemo(() => `ph-${Math.random().toString(36).slice(2)}`, []);
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
    // Placeholder CSS
    const ph = probe.placeholderStyle || {};
    const placeholderCss = `\n      .${placeholderClass}::placeholder {\n        ${ph.color ? `color: ${ph.color} !important;` : ""}\n        ${ph.opacity ? `opacity: ${ph.opacity} !important;` : ""}\n        ${ph.fontStyle ? `font-style: ${ph.fontStyle} !important;` : ""}\n        ${ph.fontWeight ? `font-weight: ${ph.fontWeight} !important;` : ""}\n        ${ph.fontSize ? `font-size: ${ph.fontSize} !important;` : ""}\n        ${ph.fontFamily ? `font-family: ${ph.fontFamily} !important;` : ""}\n        ${ph.letterSpacing ? `letter-spacing: ${ph.letterSpacing} !important;` : ""}\n      }\n    `;

    if (ol.kind === "input") {
      // Decide input vs textarea
      const isTextarea = probe.tag === "textarea";
      const commonProps = {
        autoFocus: true,
        className: placeholderClass,
        placeholder: probe.placeholder ?? "",
        defaultValue: ol.draftValue ?? probe.value ?? "",
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          if (e.key === "Enter" && !isTextarea) {
            onSubmit((e.target as HTMLInputElement | HTMLTextAreaElement).value, ol.draftLabel ?? null);
          }
          if (e.key === "Escape") onCancel();
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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


            {!(probe.type === "password" || probe.type === "email") && (
              <FormControlLabel
                control={
                  <Checkbox
                    defaultChecked
                    onChange={(e) => {
                      setOverlay(prev => prev ? { ...prev, draftStoreValue: e.target.checked } : prev);
                    }}
                  />
                }
                label="Store Value"
                title="Store Value"
                sx={{
                  "& .MuiFormControlLabel-label": {
                    fontSize: "0.7rem", 
                  },
                }}
              />
            )}

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
      <div className="remote-runner-confirm-overlay" style={{ left: box.left, top: Math.max(0, box.top - 8) }}>
        <div style={{ marginBottom: 6 }}>Click this?</div>
        <div className="remote-runner-overlay-buttons">
          <button onClick={() => onSubmit(undefined, ol.draftLabel ?? null)}>✔ Yes</button>
          <button onClick={onCancel}>✖ No</button>
        </div>
        <input
          className="remote-runner-overlay-input"
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
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const s = p.styles || {};
    const st: React.CSSProperties = {
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
      color: s.color,
      backgroundColor: s.backgroundColor,
      backgroundImage: s.backgroundImage,
      backgroundClip: s.backgroundClip as any,
      outlineWidth: s.outlineWidth,
      outlineStyle: s.outlineStyle as any,
      outlineColor: s.outlineColor,
      outlineOffset: s.outlineOffset,
      boxShadow: s.boxShadow,
      textShadow: s.textShadow,
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
      caretColor: s.caretColor as any,
      overflow: s.overflow as any,
      overflowX: s.overflowX as any,
      overflowY: s.overflowY as any,
      width: "100%",
      height: "100%",
    };
    if (!st.paddingTop) st.paddingTop = "6px";
    if (!st.paddingBottom) st.paddingBottom = "6px";
    if (!st.paddingLeft) st.paddingLeft = "8px";
    if (!st.paddingRight) st.paddingRight = "8px";
    if (!s.borderTopStyle && !s.borderTopWidth) {
      (st as any).border = "1px solid rgba(0,0,0,0.15)";
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return st;
  }


  async function handleClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);
    const p = await probeAt(coords);
    if (!p) return;

    const isTextField =
        
        (p.tag === "input" && p.type && !["button","submit","checkbox","radio","file"].includes(p.type)) ||
        p.tag === "textarea" ||
        p.contentEditable;

      if (isTextField && p.isTextControl) {
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
          timestamp: Date.now(),
          selector: preferSelectorFromProbe(p) || { strategy: "css", value: "body" }
        });
      }
  }
  function handleVisionPopup(cropArea: CropArea) { 
    const dialogX = Math.min(cropArea.endX + 20, (shot?.width ?? 800) - 300);
    const dialogY = cropArea.startY;
    console.log(cropArea)
    console.log()
    setCurrentCropArea(cropArea);
    
    setVisionPopup({
      x: dialogX, 
      y: dialogY,  
      query: "Describe what you see",
      response: null,
    });
  }
 

  return (
    <div className="remote-runner-container">
      {/* toolbar */}
      <Toolbar 
      sessionId={sessionId}
      insightId={insightId}
      mode={mode}
      setMode={setMode}
      shot={shot}
      setShot={setShot}
      loading={loading}
      setLoading={setLoading}
      steps={steps}
      setSteps={setSteps}
      />

      {/* Header / and metadata form */}
      <Header 
      insightId={insightId}
      sessionId={sessionId}
      shot={shot}
      setShot={setShot}
      steps={steps}
      setSteps={setSteps}
      loading={loading}
      setLoading={setLoading}
      title={title}
      setTitle={setTitle}
      setDescription={setDescription}
      description={description}
      mode={mode}/>

      
      {!shot && loading && (
        <div className="remote-runner-loading-container">
          {loading && <CircularProgress />}
        </div>
      )}

      {shot && (
        <>          
          <div className="remote-runner-image-container">
            {mode === "crop" ? (
              <ReactCrop
                crop={crop}
                onChange={(c: Crop) => setCrop(c)}
                onComplete={(c: Crop) => {
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
                  className="remote-runner-image"
                  onLoad={() => setLoading(false)}
                />
              </ReactCrop>
            ) : (
              <img
                ref={imgRef}
                onClick={handleClick}
                src={`data:image/png;base64,${shot.base64Png}`}
                alt="remote"
                className="remote-runner-image"
                onLoad={() => setLoading(false)}
              />
            )}

            {overlay && shot && (
              <>
                <Overlay
                  ol={overlay}
                  shot={shot}
                  imgRef={imgRef}
                  onCancel={() => setOverlay(null)}
                  onSubmit={async (value, label) => {
                    const { probe } = overlay!;
                    const draftStoreValue = overlay!.draftStoreValue ?? true;
                    const coords = {
                      x: Math.round(probe.rect.x + probe.rect.width / 2),
                      y: Math.round(probe.rect.y + probe.rect.height / 2)
                    };

                    if (overlay!.kind === "input") {
                      await sendStep({
                        type: "TYPE",
                        coords,
                        text: value ?? "",
                        label: label ?? null,
                        pressEnter: false,
                        isPassword: probe.type === "password",
                        storeValue: probe.type === "password" || probe.type === "email" ? false : draftStoreValue,
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
              <div className="remote-runner-loading-overlay">
                <CircularProgress color="inherit" />
              </div>
            )}

          <VisionPopup
            sessionId={sessionId}
            insightId={insightId}
            visionPopup={visionPopup}
            setVisionPopup={setVisionPopup}
            currentCropArea={currentCropArea}
            setCurrentCropArea={setCurrentCropArea}
            mode={mode}
            setMode={setMode}
            crop={crop}
            setCrop={setCrop}
          />
          </div>
        </>
      )}
    </div>
  );
}
