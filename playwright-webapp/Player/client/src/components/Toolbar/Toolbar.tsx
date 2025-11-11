import {
    Settings as SettingsIcon,
    AutoAwesome as AutoAwesomeIcon,
    ListAlt as ListAltIcon,
    Edit as EditIcon,
    Sync as SyncIcon,
  } from "@mui/icons-material";
import { type JSX, useState, useEffect } from "react";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../../utils/errorHandler";
import type { ToolbarProps, ScreenshotResponse, Step, Viewport } from "../../types";
import {useSendStep} from"../../hooks/useSendStep"
import StepsPanel from "../StepsPanel/StepsPanel";
import InputsPanel from "../InputsPanel/InputsPanel";
import ToolsPanel from "../ToolsPanel/ToolsPanel";
import GenerateStepsPanel from "../GenerateStepsPanel/GenerateStepsPanel";
import './Toolbar.css';
import StoredContextsSidebar from '../StoredContexts/StoredContextsSidebar';

function Toolbar(props: ToolbarProps) {
  const { sessionId, insightId, shot, setShot, mode, setMode, steps, setSteps, setLoading,
    generationUserPrompt, setGenerationUserPrompt, selectedModel, setSelectedModel, modelOptions, tabId, editedData, setEditedData, selectedRecording, tabs, setActiveTabId, isSessionExpired } = props;
  
  const [showPanel, setShowPanel] = useState(false);
  

    const viewport: Viewport = {
        width: shot?.width ?? 1280,
        height: shot?.height ?? 800,
        deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
    };


    const { sendStep } = useSendStep({
        sessionId,
        insightId,
        shot: shot,
        setShot: setShot,
        steps: steps,
        setSteps: setSteps,
        setLoading: setLoading,
      });
    async function fetchScreenshot() {
        if (!sessionId) return;
        try {
            let pixel = `Screenshot ( sessionId = "${sessionId}", tabId = "${tabId}" )`;
            const res = await runPixel(pixel, insightId);
            
            if (checkSessionExpired(res.pixelReturn)) {
              return;
            }
            
            const { output } = res.pixelReturn[0];
            const snap = normalizeShot(output);
            if (snap) setShot(snap);
        } catch (err) {
            console.error("fetchScreenshot error:", err);
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

    async function waitAndShot() {
        if (!sessionId) return;
        const ms = Number(window.prompt("Wait how many ms?", "800")) || 800;
        const step: Step = { type: "WAIT", waitAfterMs: ms, viewport, timestamp: Date.now() };
        await sendStep(step, tabId); 
    }

    async function scrollUp() {
        if (!shot) return;
            await sendStep({
            type: "SCROLL",
            coords: { x: 0, y: 0 },
            deltaY: -400,
            viewport,
            waitAfterMs: 300,
            timestamp: Date.now(),
        }, tabId);
    }

    async function scrollDown() {
        if (!shot) return;
            await sendStep({
            type: "SCROLL",
            coords: { x: 0, y: 0 },
            deltaY: 400,
            viewport,
            waitAfterMs: 300,
            timestamp: Date.now(),
         }, tabId);
    }

  const toolbarItems = [
    { m: "tools", icon: <SettingsIcon />, label: "Tools" },
    { m: "generate-steps", icon: <AutoAwesomeIcon />, label: "Generate Steps" },
    { m: "show-steps", icon: <ListAltIcon />, label: "Show Steps" },
    { m: "edit-inputs", icon: <EditIcon />, label: "Edit Inputs" }
  ] as { m: string; icon: JSX.Element; label: string }[];

  const activeItem = toolbarItems.find(item => mode === item.m);
  // All toolbar items can show a panel
  const needsPanel = true;

  // Sync panel visibility with mode - show panel for any selected mode
  useEffect(() => {
    const shouldShowPanel = mode !== undefined && mode !== "" && (mode === "tools" || mode === "show-steps" || mode === "edit-inputs" || mode === "generate-steps");
    setShowPanel(shouldShowPanel);
    
    // Add/remove class to body to adjust main content layout
    if (shouldShowPanel && activeItem) {
      document.body.classList.add('toolbar-panel-open');
    } else {
      document.body.classList.remove('toolbar-panel-open');
    }
    
    return () => {
      document.body.classList.remove('toolbar-panel-open');
    };
  }, [mode, activeItem]);

  // Listen for requests to open Steps panel (e.g., after loading a JSON file)
  useEffect(() => {
    const openStepsHandler = () => setMode("show-steps");
    window.addEventListener('openShowStepsPanel', openStepsHandler as EventListener);
    return () => window.removeEventListener('openShowStepsPanel', openStepsHandler as EventListener);
  }, [setMode]);

  return (
    <>
      <div className="toolbar-container">
        {/* Action buttons */}
        {([
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" },
        ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
          return (
            <button
              key={m}
              onClick={async () => {
                if (m === "fetch-screenshot") {
                  await fetchScreenshot();
                }
              }}
              title={label}
              className="toolbar-button"
            >
              {icon}
            </button>
          );
        })}
        
        {/* Panel toggle buttons */}
        {toolbarItems.map(({ m, icon, label }) => {
          const active = mode === m;
          const isModelRequired = m === "generate-steps";
          const disabled = isSessionExpired || (isModelRequired && !selectedModel);

          const hoverMessage =
            isSessionExpired
              ? "Session expired. Please refresh the page."
              : disabled && m === "generate-steps"
              ? "Generate steps: Please add a model to your model catalog to activate"
              : label;

          return (
            <button
              key={m}
              disabled={disabled}
              title={hoverMessage}
              aria-pressed={active}
              onClick={async () => {
                if (disabled) return;
                // Toggle behavior: if clicking the active panel icon, close the panel
                if (active) {
                  setMode("");
                  setShowPanel(false);
                  return;
                }
                if (m === "tools") {
                  setMode("tools");
                } else if (m == "generate-steps") {
                  if (!shot) {
                    alert("No screenshot available");
                    return;
                  }
                  setMode("generate-steps");
                } else if (m === "show-steps") {
                  setMode("show-steps");
                } else if (m === "edit-inputs") {
                  setMode("edit-inputs");
                } else {
                  setMode(m);
                }
              }}
              className={`toolbar-button ${active ? "toolbar-button-active" : ""} ${
                disabled ? "toolbar-button-disabled" : ""
              }`}
            >
              {icon}
              {/* {m === "show-contexts" && storedContexts && storedContexts.length > 0 && (
                <span className="toolbar-button-badge">
                  {storedContexts.length > 9 ? '9+' : storedContexts.length}
                </span>
              )} */}
            </button>
          );
        })}
      </div>
      
      {showPanel && needsPanel && activeItem && (
        <div className="toolbar-panel">
          {/* <div className="toolbar-panel-header">
            <span className="toolbar-panel-title">{activeItem.label}</span>
          </div> */}
          <div className="toolbar-panel-content">
            {mode === "tools" && (
              <ToolsPanel
                onToolSelect={(tool) => {
                  if (tool === "click") {
                    setMode("click");
                  } else if (tool === "scroll-up") {
                    scrollUp();
                    setMode("tools");
                  } else if (tool === "scroll-down") {
                    scrollDown();
                    setMode("tools");
                  } else if (tool === "delay") {
                    waitAndShot();
                    setMode("tools");
                  } else if (tool === "fetch-screenshot") {
                    fetchScreenshot();
                    setMode("tools");
                  } else if (tool === "crop") {
                    setMode("crop");
                  } else if (tool === "generate-steps") {
                    if (!shot) {
                      alert("No screenshot available");
                      return;
                    }
                    const prompt = window.prompt("Provide context for AI step generation:", generationUserPrompt);
                    if (prompt) setGenerationUserPrompt(prompt);
                    setMode("generate-steps");
                  }
                }}
                // selectedTool={mode === "click" ? "click" : mode === "crop" ? "crop" : undefined}
              />
            )}
            {mode === "show-steps" && editedData !== undefined && (
              <StepsPanel 
                steps={steps || []} 
                editedData={editedData || []} 
                sessionId={sessionId}
                insightId={insightId}
                selectedRecording={selectedRecording}
                tabs={tabs}
                activeTabId={tabId}
                setActiveTabId={setActiveTabId}
              />
            )}
            {mode === "edit-inputs" && editedData !== undefined && setEditedData !== undefined && (
              <InputsPanel editedData={editedData || []} setEditedData={setEditedData} />
            )}
            {mode === "generate-steps" && (
              <GenerateStepsPanel
                modelOptions={modelOptions || []}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                generationUserPrompt={generationUserPrompt}
                setGenerationUserPrompt={setGenerationUserPrompt}
                onGenerate={() => {
                  const prompt = window.prompt("Provide context for AI step generation:", generationUserPrompt);
                  if (prompt !== null) {
                    setGenerationUserPrompt(prompt);
                  }
                  setMode("generate-steps");
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Toolbar