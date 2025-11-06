import React, { useRef, useState } from "react";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../utils/errorHandler";
import { CircularProgress, FormControlLabel, Checkbox, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { IconButton, Tabs, Tab, Box } from "@mui/material";
import { Check, Close } from "@mui/icons-material";
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Toolbar from "./Toolbar/Toolbar";
import type { Coords, CropArea, ModelOption, Probe, ProbeRect, ScreenshotResponse, Step, Viewport } from "../types";
import Header from "./Header/Header";
import { useSendStep } from "../hooks/useSendStep";
import { preferSelectorFromProbe } from "../hooks/usePreferSelector";
import { fetchScreenshot } from "../hooks/useFetchScreenshot";
import VisionPopup from "./VisionPopup/VisionPopup";
import './remote-runner.css';
import { useSessionStore } from "../store/useSessionStore";
import { useToastNotificationStore } from "../store/useToastNotificationStore";


export default function RemoteRunner()  {
  const {
    sessionId,
    insightId,
    shot,
    setShot,
    loading,
    setLoading,
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    mode,
    selectedModel,
    setSelectedModel,
  } = useSessionStore();

  const { showToast } = useToastNotificationStore();
  const imgRef = useRef<HTMLImageElement>(null);
  const [overlay, setOverlay] = useState<{
    kind: "input" | "confirm";
    probe: Probe;
    draftValue?: string;
    draftLabel?: string | null;
  } | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [visionPopup, setVisionPopup] = useState<{x: number; y: number; query: string; response: string | null; } | null>(null);
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [showCloseTabDialog, setShowCloseTabDialog] = useState(false);
  const [tabToClose, setTabToClose] = useState<string | null>(null);

  const ENGINE_ID = import.meta.env.VITE_LLM_ENGINE_ID;
  const modelOptions: ModelOption[] = Object.entries({"Default Dev Model": ENGINE_ID}).map(([name, id]) => ({
    label: name,
    value: id,
  }));

  // Initialize selectedModel if it's null
  React.useEffect(() => {
    if (!selectedModel && modelOptions.length > 0) {
      setSelectedModel(modelOptions[0]);
    }
  }, [selectedModel, modelOptions, setSelectedModel]);

 

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTabId(newValue);

    setTimeout(() => {
      fetchScreenshot(sessionId, insightId, newValue, setShot);
    }, 100);
  };

  const handleCloseTab = (tabId: string) => {
    setTabToClose(tabId);
    setShowCloseTabDialog(true);
  };

  const proceedToCloseTab = (tabId: string) => {
    const updatedTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(updatedTabs);
    console.log("Closing tab")
  
    if (activeTabId === tabId && updatedTabs.length > 0) {
      setActiveTabId(updatedTabs[0].id);
      setTimeout(() => {
        fetchScreenshot(sessionId, insightId, updatedTabs[0].id, setShot);
      }, 100);
    }
  
  };

  const deleteTab = async (tabId: string) => {
    if (!sessionId) return;

    try {
      const pixel = `DeleteTab(sessionId="${sessionId}", tabId="${tabId}");`;
      const res = await runPixel(pixel, insightId);

      if (checkSessionExpired(res.pixelReturn)) {
        return;
      }

      const pixelReturn = res.pixelReturn[0];
      if (pixelReturn.operationType && pixelReturn.operationType.includes("ERROR")) {
        showToast(`Failed to delete tab: ${pixelReturn.output}`, "error");
        return;
      }

      showToast("Tab deleted successfully!", "success");
      proceedToCloseTab(tabId);
    } catch (err) {
      console.error("Error deleting tab:", err);
      showToast("Failed to delete tab", "error");
    }
  };

  const handleSaveAndCloseTab = () => {
    setShowCloseTabDialog(false);
    if (tabToClose) {
      proceedToCloseTab(tabToClose);
      setTabToClose(null);
    }
  };

  const handleDeleteAndCloseTab = async () => {
    setShowCloseTabDialog(false);
    if (tabToClose) {
      await deleteTab(tabToClose);
      setTabToClose(null);
    }
  };


  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  const { sendStep } = useSendStep();

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
    if (!pendingCoords) {
      showToast("Invalid Coordinates", "error");
      return;
    }

    let pixel = `ProbeElement (sessionId = "${sessionId}" , coords = "${pendingCoords?.x}, ${pendingCoords?.y}", tabId = "${activeTabId}");`
    const res = await runPixel(pixel, insightId);
    
    if (checkSessionExpired(res.pixelReturn)) {
      return;
    }
    
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

    // Force white background for overlay inputs
    st.backgroundColor = "#fff";
  
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
      } else {
        await sendStep({
          type: "CLICK",
          coords,
          viewport,
          waitAfterMs: 300,
          timestamp: Date.now(),
          selector: preferSelectorFromProbe(p) || { strategy: "css", value: "body" }
        }, activeTabId);
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
 

  return (
    <div className="remote-runner-container">
      {/* toolbar */}
      <Toolbar />

      {/* Header / and metadata form */}
      <Header />

      
      {!shot && loading && (
        <div className="remote-runner-loading-container">
          {loading && <CircularProgress />}
        </div>
      )}

      {shot && (
        <>
          <Tabs
            value={activeTabId}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                value={tab.id}
                label={
                  <Box display="flex" alignItems="center">
                    {tab.title}
                    {tabs.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab.id);
                        }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                }
              />
            ))}
          </Tabs>
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
                      } as Step, activeTabId);
                    } else {
                      await sendStep({
                        type: "CLICK",
                        coords,
                        viewport,
                        waitAfterMs: 300,
                        timestamp: Date.now()
                      } as Step, activeTabId);
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
            visionPopup={visionPopup}
            setVisionPopup={setVisionPopup}
            currentCropArea={currentCropArea}
            setCurrentCropArea={setCurrentCropArea}
            setCrop={setCrop}
          />
          </div>
        </>
      )}

      <Dialog open={showCloseTabDialog} onClose={() => setShowCloseTabDialog(false)}>
        <DialogTitle>Save Steps in This Tab Before Closing?</DialogTitle>
        <DialogContent>
          Would you like to save the steps you made in this tab?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloseTabDialog(false)} color="error" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleDeleteAndCloseTab} disabled={loading}>
            No
          </Button>
          <Button onClick={handleSaveAndCloseTab} color="primary" variant="contained" disabled={loading}>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
