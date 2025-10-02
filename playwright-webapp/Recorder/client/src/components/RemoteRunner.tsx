import React, { useRef, useState, type JSX } from "react";
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
import VisionPopup from "./VisionPopup/VisionPopup";
import '../css/remote-runner.css';


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
    // fields for the inline editor
    draftValue?: string;
    draftLabel?: string | null;
  } | null>(null);
  const [crop, setCrop] = useState<Crop>();
 const [visionPopup, setVisionPopup] = useState<{x: number; y: number; query: string; response: string | null; } | null>(null);
 const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
 const [mode, setMode] = useState<string>("click");


  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

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


            {!(probe.type === "password" || probe.type === "email") && (
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
    const p = await probeAt(coords);
    if (!p) return;

    const isTextField =
        
        (p.tag === "input" && p.type && !["button","submit","checkbox","radio","file"].includes(p.type)) ||
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
          timestamp: Date.now()});
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
      setSteps={setSteps}/>

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
                        text: value ?? "" ,
                        label: label ?? null,
                        pressEnter: false,
                        isPassword: probe.type === "password",
                        storeValue: probe.type == "password" || probe.type == "email" ? false : draftStoreValue,   
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
