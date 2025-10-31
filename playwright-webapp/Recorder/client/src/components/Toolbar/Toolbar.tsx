import {
    Mouse as MouseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    AccessTime as AccessTimeIcon,
    Sync as SyncIcon,
    CropFree as CropIcon, 
  } from "@mui/icons-material";
import { type JSX } from "react";
import type { Step, Viewport } from "../../types";
import { useSendStep } from "../../hooks/useSendStep"
import './toolbar.css';
import { fetchScreenshot } from '../../hooks/useFetchScreenshot'; 
import { useSessionStore } from "../../store/useSessionStore";

function Toolbar() {
  const {
    sessionId,
    insightId,
    shot,
    setShot,
    mode,
    setMode,
    activeTabId,
    selectedModel
  } = useSessionStore();

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  const { sendStep } = useSendStep();

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
    <div className="toolbar-container">
        {([
          { m: "click", icon: <MouseIcon />, label: "Click" },
          { m: "scroll-up", icon: <ArrowUpIcon />, label: "Scroll Up" },
          { m: "scroll-down", icon: <ArrowDownIcon />, label: "Scroll Down" },
          { m: "delay", icon: <AccessTimeIcon />, label: "Delay" },
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" },
          { m: "crop", icon: <CropIcon />, label: "Add Context" }

        ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
          const active = mode === m;
          const isModelRequired = m === "crop" || m === "generate-steps";
          const disabled = isModelRequired && !selectedModel;

          const hoverMessage = disabled && m === "crop" ? "Add context: Please add a model to your model catalog to activate" : label;

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
                } else if (m === "cancel") {
                  setMode("click");
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
      </div>
  )
}

export default Toolbar