import React, { useRef, useState, useEffect } from "react";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired, setSessionExpiredCallback } from "../utils/errorHandler";
import {
  Check, Close, Sync as SyncIcon
} from "@mui/icons-material";
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import {
  CircularProgress, IconButton
} from "@mui/material";
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { rgba } from 'polished';
import type { Action, Coords, CropArea, Overlay, Probe, ProbeRect, RemoteRunnerProps, ReplayPixelOutput, ScreenshotResponse, Step, Viewport
  , modelGeneratedSteps, ExtractedElement, ExtractionData, ModelOption, TabData } from "../types";
import { useSendStep } from "../hooks/useSendStep";
import { preferSelectorFromProbe } from "../hooks/usePreferSelector";
import Toolbar from "./Toolbar/Toolbar";
import Header from "./Header/Header";
import VisionPopup from "./VisionPopup/VisionPopup";
import './RemoteRunner.css';
import StepsBottomSection from "./StepsBottomSection/StepsBottomSection";
import { useSkipStep } from "../hooks/useSkipStep";
import { useProbeAt } from "../hooks/useProbeAt";
import { useOverlaySteps } from "../hooks/useOverlaySteps";
import { Tabs, Tab, Box } from "@mui/material";
import {Insight}  from 'https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.29/+esm';


export default function RemoteRunner({ sessionId, insightId }: RemoteRunnerProps) {

  const [loading, setLoading] = useState(false);
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [showData, setShowData] = React.useState(false);
  const [editedData, setEditedData] = React.useState<Action[]>([]);
  const [updatedData, setUpdatedData] = React.useState<Action[]>([]);
  const [live, setLive] = useState(false);
  const [intervalMs] = useState(1000);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [lastPage, setIsLastPage] = useState(false);
  const [highlight, setHighlight] = useState<Coords | null>(null);
  const [overlay, setOverlay] = useState< Overlay | null>(null);
  const [visionPopup, setVisionPopup] = useState<{ x: number; y: number; query: string; response: string | null; } | null>(null);
  const [currentCropArea, setCurrentCropArea] = useState<CropArea | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [mode, setMode] = useState<string>("click");
  const [generationUserPrompt, setGenerationUserPrompt] = useState(" ");
  const [currUserModels, setCurrUserModels] = useState<Record<string, string>>({});
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [storedContexts, setStoredContexts] = useState<string[]>([]);
  const modelOptions: ModelOption[] = Object.entries(currUserModels).map(([name, id]) => ({
    label: name,
    value: id,
  }));
  const [selectedModel, setSelectedModel] = React.useState<ModelOption | null>(
    modelOptions[0] ?? null
  );

  const [tabs, setTabs] = useState<TabData[]>([
    { id: "tab-1", title: "New Tab", actions: [] }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  // const [showFutureSteps, setShowFutureSteps] = useState<boolean>(true);
  const showFutureSteps = true;
  
  // Set up session expired callback
  useEffect(() => {
    setSessionExpiredCallback(() => {
      setIsSessionExpired(true);
    });
  }, []);

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
    // Auto-show input overlay for TYPE steps
    if (editedData && editedData.length > 0 && !overlay && !loading && showData && shot && !isSessionExpired) {
      const handleSetOverlayForType = async () => {
        await setOverlayForType();
      };
      handleSetOverlayForType();
    }
  }, [editedData, overlay, loading, showData, shot, isSessionExpired]);


  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  async function setOverlayForType() {
    setIsSessionExpired(isSessionExpired);
    const nextAction = editedData[0];
    if ("TYPE" in nextAction) {
      const typeAction = nextAction.TYPE;

      const insight = new Insight();
      const initRes: any = await insight.initialize();
      const tool = await initRes?.tool;

      // Check if we have initial parameter values from tool parameters
      let initialValue = typeAction.text;
      // Following the same approach as in Header.tsx for accessing tool parameters
      if (tool?.parameters?.paramValues) {
        const paramValues = tool?.parameters?.paramValues;
        // Loop through paramValues and check if any of them has the label
        for (const [key, value] of Object.entries(paramValues)) {
          // Compare case-insensitive and ignore spaces/hyphens/underscores
          const normalizedKey = key.toLowerCase().replace(/[\s\-_]/g, '');
          const normalizedLabel = (typeAction.label || '').toLowerCase().replace(/[\s\-_]/g, '');
          if (normalizedKey === normalizedLabel) {
            initialValue = value as string;
            break;
          }
        }
      }
      
      const probe: Probe = typeAction.probe || {
        tag: "input",
        type: typeAction.isPassword ? "password" : "text",
        inputCategory: "text",
        role: null,
        selector: null,
        placeholder: null,
        labelText: typeAction.label,
        value: initialValue,
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
        draftValue: initialValue,
        draftLabel: typeAction.label
      });
    }
  }
  
  const { sendStep } = useSendStep({
    insightId : insightId,
    sessionId : sessionId,
    shot: shot,
    setShot: setShot,
    steps: steps,
    setSteps: setSteps,
    setLoading: setLoading,
    tabs: tabs,
    setTabs: setTabs,
    _activeTabId: activeTabId,
    setActiveTabId: setActiveTabId
  });

  const { handleSkipStep } = useSkipStep({
    sessionId,
    selectedRecording,
    insightId,
    setEditedData,
    setIsLastPage,
    setOverlay,
    setLoading,
    activeTabId
  });

  const { renderStepLabels } = useOverlaySteps({
    shot,
    editedData,
    imgRef,
    showFutureSteps,
    loading,
    handleNextStep,
    handleSkipStep,
  });


  function imageToPageCoords(e: React.MouseEvent<HTMLImageElement, MouseEvent>): Coords {
    const img = imgRef.current!;
    const rect = img.getBoundingClientRect();
    const scaleX = shot!.width / rect.width;
    const scaleY = shot!.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x: Math.round(x), y: Math.round(y) };
  }


  async function handleClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);
    const p = await useProbeAt(coords, sessionId, insightId, activeTabId);
    if (!p) return;

    const isTextField =
      (p.tag === "input" && p.type && !["button", "submit", "checkbox", "radio", "file"].includes(p.type)) ||
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
    
  async function fetchScreenshot(tabIdParam?: string) {
    if (!sessionId) return;
    const targetTabId = tabIdParam || activeTabId || "tab-1";
    try {
      let pixel = `Screenshot ( sessionId = "${sessionId}", tabId="${targetTabId}" )`;
      const res = await runPixel(pixel, insightId);
      
      if (checkSessionExpired(res.pixelReturn)) {
        return;
      }
      
      const { output } = res.pixelReturn[0];
      const snap = normalizeShot(output);
      if (snap) {
        setShot(snap);
        
        if (overlay && editedData.length > 0 && "TYPE" in editedData[0]) {
          const typeAction = editedData[0].TYPE;
          setOverlay(null);
          const p = await useProbeAt({x: typeAction.coords?.x, y: typeAction.coords?.y} as Coords, sessionId, insightId, activeTabId);
          if (p) {
            setOverlay({ ...overlay, probe: p });
          } else {
            setOverlay(null);
          }
        }
      }   
    } catch (err) {
      console.error("fetchScreenshot error:", err);
    }
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    console.log("Tab changed to:", newValue);
    setActiveTabId(newValue);
    
    // Load the selected tab's actions
    const selectedTab = tabs.find(t => t.id === newValue);
    if (selectedTab) {
      console.log("Loading actions for tab:", newValue, selectedTab.actions);
      setEditedData(selectedTab.actions);
      setUpdatedData(selectedTab.actions);
    } else {
      console.warn("Tab not found:", newValue);
      setEditedData([]);
      setUpdatedData([]);
    }
    
    setTimeout(() => {
      fetchScreenshot(newValue);
    }, 100);
  };
  
  const handleCloseTab = (tabId: string) => {
    const updatedTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(updatedTabs);
  
    if (activeTabId === tabId && updatedTabs.length > 0) {
      setActiveTabId(updatedTabs[0].id);
      const selectedTab = tabs.find(t => t.id === updatedTabs[0].id);
      if (selectedTab) {
        console.log("Loading actions for tab:", updatedTabs[0].id, selectedTab.actions);
        setEditedData(selectedTab.actions);
        setUpdatedData(selectedTab.actions);
      } else {
        console.warn("Tab not found:", updatedTabs[0].id);
        setEditedData([]);
        setUpdatedData([]);
      }
      
      setTimeout(() => {
        fetchScreenshot(updatedTabs[0].id);
      }, 100);
      }
  };

  async function handleNextStep() {
    const nextAction = editedData[0];
    
    if (!nextAction) {
      console.log("No action to execute");
      return;
    }
        
    const actionTabId = (nextAction as any).tabId || activeTabId || "tab-1";

      if ("CONTEXT" in nextAction) {
      const coords = nextAction.CONTEXT.multiCoords;
      console.log("CONTEXT action detected - showing crop overlay");
      if (coords && coords.length >= 2) {
        setCurrentCropArea({
          startX: coords[0].x,
          startY: coords[0].y,
          endX: coords[1].x,
          endY: coords[1].y
        });
        setVisionPopup({
          x: coords[1].x,
          y: coords[0].y,
          query: nextAction.CONTEXT.prompt,
          response: null
        });
        setMode("crop");
        
        setCrop({
          unit: 'px',
          x: coords[0].x,
          y: coords[0].y,
          width: coords[1].x - coords[0].x,
          height: coords[1].y - coords[0].y
        });
      }
    }
    
    
    if (!selectedRecording) {
      setLoading(true);
      
      try {
        if ("CLICK" in nextAction) {
          const p = await useProbeAt(nextAction.CLICK.coords, sessionId, insightId, actionTabId);
          await sendStep({
            type: "CLICK",
            coords: nextAction.CLICK.coords,
            viewport,
            timestamp: Date.now(),
            waitAfterMs: 1000,
            selector: preferSelectorFromProbe(p) || { strategy: "css", value: "body" }
          }, actionTabId);
        } else if ("TYPE" in nextAction) {
          const text = overlay?.draftValue ?? nextAction.TYPE.text;
          await sendStep({
            type: "TYPE",
            coords: nextAction.TYPE.coords || { x: 0, y: 0 },
            text: text,
            label: nextAction.TYPE.label,
            isPassword: nextAction.TYPE.isPassword || false,
            viewport,
            timestamp: Date.now(),
            waitAfterMs: 1000,
            storeValue: false,
            selector: { strategy: "css", value: "body" }
          }, actionTabId);
        }
        
        setTabs(prevTabs => prevTabs.map(tab => {
          if (tab.id === actionTabId) {
            const newActions = tab.actions.slice(1);
            return { ...tab, actions: newActions };
          }
          return tab;
        }));
        
        const newEditedData = editedData.slice(1);
        setEditedData(newEditedData);
        setUpdatedData(newEditedData);
        setOverlay(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    let pixel;
    
    if ("TYPE" in nextAction) {
      if (overlay && overlay.draftValue !== undefined) {
        nextAction.TYPE.text = overlay.draftValue;
      }
      const { label, text } = nextAction.TYPE;
      let paramValues = { [label]: text };
      pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${actionTabId}", paramValues=[${JSON.stringify(paramValues)}], executeAll=false);`;
      setOverlay(null);
    } else {
      pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${selectedRecording}", tabId="${actionTabId}", executeAll=false);`;
    }
    
    setLoading(true);
    const res = await runPixel(pixel, insightId);
    
    if (checkSessionExpired(res.pixelReturn)) {
      setLoading(false);
      setOverlay(null);
      return;
    }
    
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };
  
    console.log("ReplayStep output:", output);
  
    // Check if this action opened a new tab
    const isNewTab = output.isNewTab;
    const newTabId = output.newTabId;
    const tabTitle = output.tabTitle;
    
    if (isNewTab && newTabId) {
      console.log("New tab detected:", newTabId, tabTitle);
      
      // Check if tab already exists
      const tabExists = tabs.find(t => t.id === newTabId);
      
      if (!tabExists) {
        setTabs(prevTabs => {
          const updatedPrevTabs = prevTabs.map(tab => {
            if (tab.id === actionTabId) {
              return { ...tab, actions: tab.actions.slice(1) };
            }
            return tab;
          });
          
          const newTabs = [...updatedPrevTabs, {
            id: newTabId,
            title: tabTitle || newTabId,
            actions: output.actions || []
          }];
          console.log("Updated tabs array:", newTabs);
          return newTabs;
        });
      } else {
        setTabs(prevTabs => prevTabs.map(tab => {
          if (tab.id === actionTabId) {
            return { ...tab, actions: tab.actions.slice(1) };
          } else if (tab.id === newTabId) {
            // Update the new tab
            return { ...tab, title: tabTitle || newTabId, actions: output.actions || [] };
          }
          return tab;
        }));
      }
      
      // Switch to the new tab
      setActiveTabId(newTabId);
      console.log("Switched to tab:", newTabId);
      
      // Update displayed actions for the NEW tab
      setEditedData(output.actions || []);
      setUpdatedData(output.actions || []);
    } else {
      const newEditedData = editedData.slice(1);
      console.log("newEditedData after executing step:", newEditedData);
      if (!newEditedData || newEditedData.length === 0) {
        console.log("No more edited data, setting to output actions");
        setEditedData(output.actions);
        setUpdatedData(output.actions);
      } else {
        console.log("Merging output actions into remaining edited data");
        const updatedEditedData = newEditedData.map((action, index) => {
          if (output.actions[index]) {
            return { ...action, ...output.actions[index] };
          }
          return action;
        });
        setEditedData(updatedEditedData);
      }
      
      setUpdatedData(output.actions);
      
      if (tabs && setTabs && activeTabId) {
        console.log("Updating tabs actions for tab:", actionTabId);
        console.log("New actions for tab:", output.actions || []);
        setTabs(prevTabs => prevTabs.map(tab => {
          if (tab.id === actionTabId) {
            return { ...tab, actions: output.actions || tab.actions.slice(1) };
          }
          return tab;
        }));
      }
    }
    
    setLoading(false);
    setShowData(true);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
    setOverlay(null);
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

  function findElementBySelector(elements: ExtractedElement[], selector: string, coords: string): ExtractedElement | undefined {
    console.log("Finding element for selector:", selector, "and coords:", coords);
  
    let ariaLabelMatch = selector.match(/\[aria-label=['"](.+?)['"]\]/);
    let ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : undefined;
  
    let baseSelector = selector.replace(/\[aria-label=['"].+?['"]\]/, '');
  
    if (!coords) {
      return elements.find(el =>
        el.selector === baseSelector &&
        (!ariaLabel || el.attributes?.['aria-label'] === ariaLabel)
      );
    }
  
    const [xStr, yStr] = coords.split(",").map(s => s.trim());
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);
  
    return elements.find(el =>
      el.selector === baseSelector &&
      (!ariaLabel || el.attributes?.['aria-label'] === ariaLabel) &&
      el.rect.x === x &&
      el.rect.y === y
    );
  }

  async function handleAiStepGeneration(cropArea: CropArea) {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      // Extract HTML with coordinates from the cropped area
      const extractPixel = `ExtractElementsDataForLLM(
        sessionId="${sessionId}", 
        tabId = "${activeTabId}",
        paramValues=[{
          "startX": ${cropArea.startX}, 
          "startY": ${cropArea.startY}, 
          "endX": ${cropArea.endX}, 
          "endY": ${cropArea.endY}
        }]
      )`;
      
      const extractRes = await runPixel(extractPixel, insightId);
      
      if (checkSessionExpired(extractRes.pixelReturn)) {
        setLoading(false);
        return;
      }
      
      const extractionData = extractRes.pixelReturn[0].output as ExtractionData;
      
      console.log("Extracted HTML data:", extractionData);
      
      let engineId = selectedModel?.value;

      // Generate steps
      const generatePixel = `GeneratePlaywrightSteps(
        engine="${engineId}", 
        sessionId = "${sessionId}",
        paramValues=[{"extractionData": ${JSON.stringify(extractionData)}, "userContext": "${generationUserPrompt}", "cropParams":${JSON.stringify(cropArea)}}]
      )`;
      
      const generateRes = await runPixel(generatePixel, insightId);
      
      if (checkSessionExpired(generateRes.pixelReturn)) {
        setLoading(false);
        return;
      }
      
      const aiResult = generateRes.pixelReturn[0].output as modelGeneratedSteps;
      
      console.log("AI Result:", aiResult);
      
      if (!aiResult.success) {

        //add static steps for demo purposes
        alert("AI step generation failed, loading demo steps instead.");
        console.log(extractionData.elements.find(el => el.tag === "input"));
        aiResult.stepsJson = JSON.stringify([
          { type: "CLICK", selector: extractionData.elements.find(el => el.tag === "input")?.selector || "", description: "Click on the first input field" },
          { type: "TYPE", selector: extractionData.elements.find(el => el.tag === "input" && el.attributes?.type !== "hidden")?.selector || "", text: "testuser", description: "Type 'testuser' into the input field" },
          { type: "CLICK", selector: extractionData.elements.find(el => el.tag === "button" || el.tag === "input" && (el.attributes?.type === "submit" || el.attributes?.type === "button"))?.selector || "", description: "Click on the submit button" },
          { type: "WAIT", waitAfterMs: 1000, description: "Wait for 1 second" }
        ]);
      }
      
      let parsedActions: Action[];
      try {
        // [{"type": "CLICK", "selector": "...", "description": "..."}, ...]
        const rawSteps = JSON.parse(aiResult.stepsJson || aiResult.rawResponse);
        
        parsedActions = rawSteps.map((step: any) => {
          if (step.type === "CLICK") {
            console.log("Processing CLICK step:", step);
            // Find the element in extractionData to get its coordinates
            const element = findElementBySelector(extractionData.elements, step.selector, step.coords);
            if (!element) {
              console.warn("Element not found for selector:", step.selector);
              return null;
            }
            
            // Calculate center coordinates from rect
            return {
              CLICK: {
                coords: {
                  x: Math.round(element.rect.x + element.rect.width / 2) as number,
                  y: Math.round(element.rect.y + element.rect.height / 2) as number
                }
              }
            };
          } else if (step.type === "TYPE") {
            const element = findElementBySelector(extractionData.elements, step.selector, step.coords);
            if (!element) {
              console.warn("Element not found for selector:", step.selector);
              return null;
            }
            
            return {
              TYPE: {
                label: element.attributes?.placeholder || element.text || step.description || "Input",
                text: step.text || "",
                isPassword: element.attributes?.type === "password",
                coords: {
                  x: Math.round(element.rect.x + element.rect.width / 2) as number,
                  y: Math.round(element.rect.y + element.rect.height / 2) as number
                }
                //pixel call to probe element
              }
            };
          } else if (step.type === "WAIT") {
            return { WAIT: 1000 };
          }
          return null;
        }).filter(Boolean) as Action[];
        
      } catch (err) {
        console.error("Failed to parse AI steps:", err);
        alert("Failed to parse AI-generated steps: " + err);
        return;
      }

      //for each action, add probe data by calling pixel
      for (let action of parsedActions) {
        if ("TYPE" in action && action.TYPE.coords) {
          const probe = await useProbeAt(action.TYPE.coords, sessionId, insightId, activeTabId);
          if (probe) {
            action.TYPE.probe = probe;
          }
        }
      }
      
      console.log("Parsed actions with coordinates:", parsedActions);
      
      // Load into editedData 
      setEditedData(parsedActions);
      setUpdatedData(parsedActions);
      setShowData(true);
      setIsLastPage(false);
      setSelectedRecording(null); // Clear selected recording since these are generated
      
      setMode("click");
      setCrop(undefined);
      
    } catch (err) {
      console.error("Error:", err);
      alert("Error: " + err);
    } finally {
      setLoading(false);
    }
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
    let overlayBackground;
    if (s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'transparent' || !s.backgroundColor) {
      overlayBackground = 'rgba(255, 255, 255, 0.5)';
    } else {
      try {
        overlayBackground = rgba(s.backgroundColor, 0.5);
      } catch {
        overlayBackground = s.backgroundColor;
      }
    }
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
      backgroundColor: overlayBackground,
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

    st.backgroundColor = "#fff";
  
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
  
  
    // Wrapper strictly matches the element's (scaled) rect

    // Wrapper strictly matches the element's (scaled) rect
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
          // Update editedData in real-time
          if (editedData && editedData.length > 0 && "TYPE" in editedData[0]) {
            setEditedData(prevData => {
              const updatedData = [...prevData];
              if (updatedData.length > 0 && "TYPE" in updatedData[0]) {
                updatedData[0] = {
                  TYPE: {
                    ...updatedData[0].TYPE,
                    text: e.target.value
                  }
                };
              }
              return updatedData;
            });
          }
          // Notify StepsPanel to sync its TextField
          try {
            const labelForEvent = (ol.draftLabel ?? probe.labelText ?? null);
            window.dispatchEvent(new CustomEvent('stepTextDraftFromOverlay', {
              detail: { label: labelForEvent, text: e.target.value }
            }));
          } catch {}
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
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <IconButton
              size="small"
              onClick={() => onSubmit(ol.draftValue, ol.draftLabel ?? null)}
              color="success"
              sx ={{ backgroundColor: 'rgba(25, 118, 210, 0.1)' }}
            >
              <Check fontSize="small" />
            </IconButton>

            <IconButton size="small" onClick={onCancel} color="error" sx ={{ backgroundColor: 'rgba(25, 118, 210, 0.1)' }}
>
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
  
  // Listen for edits coming from StepsPanel to update overlay and local editedData
  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ label: string | null; text: string }>;
      const incoming = ce.detail;
      // Update overlay draft if current overlay is an input
      setOverlay(prev => {
        if (!prev || prev.kind !== 'input') return prev;
        const currentLabel = prev.draftLabel ?? prev.probe.labelText ?? null;
        // If labels are comparable, or no label provided, still update to keep in sync
        if (incoming.label == null || currentLabel == null || incoming.label === currentLabel) {
          return { ...prev, draftValue: incoming.text };
        }
        return prev;
      });
      // Also update first TYPE in editedData if present
      setEditedData(prev => {
        if (!prev || prev.length === 0) return prev;
        const first = prev[0];
        if (!("TYPE" in first)) return prev;
        const currentLabel = first.TYPE.label ?? null;
        if (incoming.label == null || currentLabel == null || incoming.label === currentLabel) {
          const updated = [...prev];
          updated[0] = { TYPE: { ...first.TYPE, text: incoming.text } };
          return updated;
        }
        return prev;
      });
    };
    window.addEventListener('stepTextDraftFromPanel', handler as EventListener);
    return () => window.removeEventListener('stepTextDraftFromPanel', handler as EventListener);
  }, [setEditedData, setOverlay]);

  return (
    <div className="remote-runner-container">
      {/* First column: Sidebar icons */}
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
        generationUserPrompt={generationUserPrompt}
        setGenerationUserPrompt={setGenerationUserPrompt}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        modelOptions={modelOptions}
        tabId={activeTabId}
        setActiveTabId={setActiveTabId}
        editedData={editedData}
        setEditedData={setEditedData}
        selectedRecording={selectedRecording}
        tabs={tabs}
        isSessionExpired={isSessionExpired}
        storedContexts={storedContexts}
        setStoredContexts={setStoredContexts}
      />

      {/* Third column: Main content area */}
      <div className="remote-runner-main-content">
        {/* Top row: Header with controls */}
        <div className="remote-runner-top-row">
          <div className="remote-runner-top-row-left">
            <Header
              insightId={insightId} 
              sessionId={sessionId}
              steps={steps}
              selectedRecording={selectedRecording}
              setSelectedRecording={setSelectedRecording}
              setLoading={setLoading}
              setEditedData={setEditedData}
              setUpdatedData={setUpdatedData}
              setShowData={setShowData}
              setShot={setShot} 
              setIsLastPage={setIsLastPage}
              live={live}
              setLive={setLive}
              currUserModels={currUserModels}
              setCurrUserModels={setCurrUserModels}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              tabs={tabs}
              setTabs={setTabs}
              activeTabId={activeTabId}
              setActiveTabId={setActiveTabId}
            />
          </div>
          <div className="remote-runner-top-row-right">
            <IconButton onClick={async () => {
              if (!sessionId || !activeTabId) return;
              setLoading(true);
              try {
                const pixel = `Screenshot ( sessionId = "${sessionId}", tabId = "${activeTabId}" )`;
                const res = await runPixel(pixel, insightId);
                if (res?.pixelReturn?.[0]?.output) {
                  const snap = {
                    base64Png: res.pixelReturn[0].output.base64Png ?? res.pixelReturn[0].output.base64 ?? "",
                    width: res.pixelReturn[0].output.width ?? 1280,
                    height: res.pixelReturn[0].output.height ?? 800,
                    deviceScaleFactor: res.pixelReturn[0].output.deviceScaleFactor ?? 1,
                  };
                  if (snap.base64Png) {
                    setShot(snap);
                  }
                }
              } catch (err) {
                console.error("Refresh error:", err);
              } finally {
                setLoading(false);
              }
            }} title="Refresh">
              <SyncIcon />
            </IconButton>
            <IconButton onClick={() => setLive(false)} disabled={!live} title="Stop">
              <StopCircleOutlinedIcon />
            </IconButton>
          </div>
        </div>

        {/* Middle row: Screenshot display */}
        <div className="remote-runner-middle-row">
          {shot && tabs.length > 0 && (
            <div className="remote-runner-tab-bar">
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
              </div>
          )}

          <div className="remote-runner-screenshot-area">
            {!shot && loading && (
              <div 
              style={{
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: "#f5f6fa",
                borderRadius: "8px"
                }}
              >
                {loading && <CircularProgress/>}
                </div>
              )}
              { shot && (
              <div className="screenshot-container">
                {mode === "crop" || mode === "generate-steps" ? (
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
                        if (mode === "generate-steps") {
                          handleAiStepGeneration(cropArea);
                        } else {
                          handleVisionPopup(cropArea);
                        }
                      }
                    }}
                    aspect={undefined}
                  >
                    <img
                      ref={imgRef}
                      src={`data:image/png;base64,${shot.base64Png}`}
                      alt="remote"
                      className="screenshot-image"
                      onLoad={() => setLoading(false)}
                    />
                  </ReactCrop>
                ) : (
                  <img
                    ref={imgRef}
                    onClick={handleClick}
                    src={`data:image/png;base64,${shot.base64Png}`}
                    alt="remote"
                    className={`screenshot-image ${mode === "scroll" ? "screenshot-image-scroll" : "screenshot-image-click"}`}
                    onLoad={() => setLoading(false)}
                  />
                )}

                {highlight && (
                  <div
                    className="highlight-indicator"
                    style={{
                      top: (highlight.y * imgRef.current!.height) / shot.height - 15,
                      left: (highlight.x * imgRef.current!.width) / shot.width - 15,
                      width: 30,
                      height: 30,
                    }}
                  ></div>
                )}

                {loading && (
                  <div className="loading-overlay">
                    <CircularProgress color="inherit" />
                  </div>
                )}

                {overlay && shot && (
                  <>
                    <Overlay
                      ol={overlay}
                      shot={shot}
                      imgRef={imgRef}
                      onCancel={handleSkipStep}
                      onSubmit={async () => {
                        await handleNextStep();
                        setOverlay(null);
                      }}
                    />
                  </>
                )}

                {/* VisionPopup */}
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
                  selectedModel={selectedModel}
                  tabId={activeTabId}
                  storedContexts={storedContexts}
                  setStoredContexts={setStoredContexts}
                  imgRef={imgRef}
                />

                {/* Permanent Step Labels */}
                {renderStepLabels()}
              </div>
          )}
          </div>
        </div>

        {/* Bottom row: Control bar */}
        <div className="remote-runner-bottom-row">
          <StepsBottomSection 
            insightId={insightId}
            sessionId={sessionId}
            showData={showData}
            setShowData={setShowData}
            lastPage={lastPage}
            setIsLastPage={setIsLastPage}
            editedData={editedData}
            overlay={overlay}
            setOverlay={setOverlay}
            selectedRecording={selectedRecording}
            setLoading={setLoading}
            setEditedData={setEditedData}
            updatedData={updatedData}
            setUpdatedData={setUpdatedData}
            setShot={setShot}
            setHighlight={setHighlight}
            steps={steps}
            setSteps={setSteps}
            shot={shot}
            activeTabId={activeTabId}  
            tabs={tabs}  
            setTabs={setTabs} 
            setActiveTabId={setActiveTabId}
            setVisionPopup={setVisionPopup}
            setCurrentCropArea={setCurrentCropArea}
            setMode={setMode} 
            setCrop={setCrop} 
            imgRef={imgRef}
          />
        </div>
      </div>
    </div>
  );
}