import {
    Mouse as MouseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    AccessTime as AccessTimeIcon,
    Sync as SyncIcon,
    CropFree as CropIcon, 
    AutoAwesome as AutoAwesomeIcon,
  } from "@mui/icons-material";
import { type JSX } from "react";
import { runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../../utils/errorHandler";
import type { ToolbarProps, ScreenshotResponse, Step, Viewport } from "../../types";
import {useSendStep} from"../../hooks/useSendStep"
import './Toolbar.css';

function Toolbar(props: ToolbarProps) {
  const { sessionId, insightId, shot, setShot, mode, setMode, steps, setSteps, setLoading,
    generationUserPrompt, setGenerationUserPrompt, selectedModel, tabId} = props;

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

  return (
    <div className="toolbar-container">
        {([
          { m: "click", icon: <MouseIcon />, label: "Click" },
          { m: "scroll-up", icon: <ArrowUpIcon />, label: "Scroll Up" },
          { m: "scroll-down", icon: <ArrowDownIcon />, label: "Scroll Down" },
          { m: "delay", icon: <AccessTimeIcon />, label: "Delay" },
          { m: "fetch-screenshot", icon: <SyncIcon />, label: "Refresh" },
          { m: "crop", icon: <CropIcon />, label: "Add Context" },
          { m: "generate-steps", icon: <AutoAwesomeIcon />, label: "Generate Steps" }


        ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
          const active = mode === m;
          const isModelRequired = m === "crop" || m === "generate-steps";
          const disabled = isModelRequired && !selectedModel;

          const hoverMessage =
            disabled && m === "crop"
              ? "Add context: Please add a model to your model catalog to activate"
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
                if (m === "scroll-up") {
                  scrollUp();
                } else if (m === "scroll-down") {
                  scrollDown();
                } else if (m == "delay") {
                  await waitAndShot();
                } else if (m == "fetch-screenshot") {
                  await fetchScreenshot();
                } else if (m === "cancel") {
                  setMode("click");
                } else if (m == "crop") {
                  setMode("crop");
                } else if (m == "generate-steps") {
                  if (!shot) {
                    alert("No screenshot available");
                    return;
                  }
                  const prompt = window.prompt("Provide context for AI step generation:", generationUserPrompt);
                  if (prompt) setGenerationUserPrompt(prompt);
                  setMode("generate-steps");
                } else {
                  setMode(m);
                }
              }}
              className={`toolbar-button ${active ? "toolbar-button-active" : ""} ${
                disabled ? "toolbar-button-disabled" : ""
              }`}
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
  )
}

export default Toolbar