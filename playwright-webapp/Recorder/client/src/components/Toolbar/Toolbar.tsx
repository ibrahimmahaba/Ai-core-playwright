import {
    Mouse as MouseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    AccessTime as AccessTimeIcon,
    Sync as SyncIcon,
    CropFree as CropIcon,
    Settings as SettingsIcon,
    Edit as EditIcon,
    ListAlt as ListAltIcon,
  } from "@mui/icons-material";
import { type JSX, useState, useEffect } from "react";
import type { Step, Viewport } from "../../types";
import {useSendStep} from"../../hooks/useSendStep"
import './toolbar.css';
import { fetchScreenshot } from '../../hooks/useFetchScreenshot';
import { useSessionStore } from "../../store/useSessionStore";
import InputsPanel from '../InputsPanel/InputsPanel';
import StepsPanel from '../StepsPanel/StepsPanel';
import ToolsPanel from '../ToolsPanel/ToolsPanel'; 
function Toolbar() {
  const {
    sessionId,
    insightId,
    shot,
    setShot,
    mode,
    setMode,
    activeTabId,
    selectedModel,
    selectedModel,
    isSessionExpired,
    tabs, setTabs} = useSessionStore();
  const [showPanel, setShowPanel] = useState(false);
  const [showInputsMenu, setShowInputsMenu] = useState(false);
  const [showExpandedView, setShowExpandedView] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState<{tabId: string; stepIndex: number} | null>(null);
  const [editedLabel, setEditedLabel] = useState<string>("");
  const [editedValue, setEditedValue] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editedSteps, setEditedSteps] = useState<Map<string, {tabId: string; stepIndex: number; label: string; text: string; storeValue: boolean; stepId?: number}>>(new Map());
  const [originalSteps, setOriginalSteps] = useState<Map<string, {storeValue: boolean}>>(new Map());
  
  const editingRef = useRef<HTMLDivElement>(null);
  const saveActionsRef = useRef<HTMLDivElement>(null);

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  const { sendStep } = useSendStep();

  const toolbarItems = [
    { m: "tools", icon: <SettingsIcon />, label: "Tools" },
    { m: "show-steps", icon: <ListAltIcon />, label: "Show Steps" },
    { m: "edit-inputs", icon: <EditIcon />, label: "Edit Inputs" }
  ] as { m: string; icon: JSX.Element; label: string }[];

  const activeItem = toolbarItems.find(item => mode === item.m);
  const needsPanel = true;

  // Sync panel visibility with mode - show panel for any selected mode
  useEffect(() => {
    const shouldShowPanel = mode !== undefined && mode !== "" && (mode === "tools" || mode === "show-steps" || mode === "edit-inputs");
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

  async function waitAndShot() {
    if (!sessionId) return;
    const ms = Number(window.prompt("Wait how many ms?", "800")) || 800;
    const step: Step = { type: "WAIT", waitAfterMs: ms, viewport, timestamp: Date.now() };
    await sendStep(step, activeTabId);
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
    }, activeTabId);
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
    }, activeTabId);
  }


  return (
    <>
      <div className="toolbar-container">
        {/* Action buttons */}
        {([
          // { m: "click", icon: <MouseIcon />, label: "Click" },
          // { m: "scroll-up", icon: <ArrowUpIcon />, label: "Scroll Up" },
          // { m: "scroll-down", icon: <ArrowDownIcon />, label: "Scroll Down" },
          // { m: "delay", icon: <AccessTimeIcon />, label: "Delay" },
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" },
          // { m: "crop", icon: <CropIcon />, label: "Add Context" },
        ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
          const active = mode === m;
          const isModelRequired = m === "crop" || m === "generate-steps";
          const disabled = isSessionExpired || (isModelRequired && !selectedModel);

          const hoverMessage = isSessionExpired 
            ? "Session expired. Please refresh the page or start a new flow by clicking open url."
            : (disabled && m === "crop" 
              ? "Add context: Please add a model to your model catalog to activate" 
              : label);

          return (
            <button
              key={m}
              onClick={async () => {
                if (m === "scroll-up") {
                  scrollUp();
                } else if (m === "scroll-down") {
                  scrollDown();
                } else if (m == "delay") {
                  await waitAndShot();
                } else if (m == "fetch-screenshot") {
                  await fetchScreenshot(sessionId, insightId, activeTabId, setShot);
                } else if (m == "crop") {
                  setMode("crop");
                } else {
                  setMode(m);
                }
              }}
              title={hoverMessage}
              aria-pressed={active}
              disabled={disabled}
              className={`toolbar-button ${active ? "toolbar-button-active" : ""} ${
                disabled ? "toolbar-button-disabled" : ""
              }`}
            >
              {icon}
            </button>
          );
        })}
        
        {/* Panel toggle buttons */}
        {toolbarItems.map(({ m, icon, label }) => {
          const active = mode === m;

          return (
            <button
              key={m}
              title={label}
              aria-pressed={active}
              onClick={() => {
                if (mode === m) {
                  setMode("click");
                } else {
                  setMode(m);
                }
              }}
              className={`toolbar-button ${active ? "toolbar-button-active" : ""}`}
            >
              {icon}
            </button>
          );
        })}
      </div>
      
      {showPanel && needsPanel && activeItem && (
        <div className="toolbar-panel">
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
                    fetchScreenshot(sessionId, insightId, activeTabId, setShot);
                    setMode("tools");
                  } else if (tool === "crop") {
                    setMode("crop");
                  }
                }}
                selectedTool={mode === "click" ? "click" : mode === "crop" ? "crop" : undefined}
              />
            )}
            {mode === "show-steps" && (
              <StepsPanel tabs={tabs} activeTabId={activeTabId} />
            )}
            {mode === "edit-inputs" && (
              <InputsPanel tabs={tabs} activeTabId={activeTabId} />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Toolbar