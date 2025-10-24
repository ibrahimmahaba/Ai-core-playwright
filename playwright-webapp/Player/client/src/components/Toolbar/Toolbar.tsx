import {
    Mouse as MouseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    AccessTime as AccessTimeIcon,
    CropFree as CropIcon,
    AutoAwesome as AutoAwesomeIcon,
  } from "@mui/icons-material";
import { type JSX } from "react";
import type { ToolbarProps, Step, Viewport } from "../../types";
import {useSendStep} from"../../hooks/useSendStep"
import './Toolbar.css';

function Toolbar(props: ToolbarProps) {
  const { sessionId, insightId, shot, setShot, mode, setMode, steps, setSteps, setLoading, generationUserPrompt, setGenerationUserPrompt } = props;

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

    async function waitAndShot() {
        if (!sessionId) return;
        const ms = Number(window.prompt("Wait how many ms?", "800")) || 800;
        const step: Step = { type: "WAIT", waitAfterMs: ms, viewport, timestamp: Date.now() };
        await sendStep(step); 
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
        })
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
         });
    }

  return (
    <div className="toolbar-container">
        {([
          { m: "click", icon: <MouseIcon />, label: "Click" },
          { m: "scroll-up", icon: <ArrowUpIcon />, label: "Scroll Up" },
          { m: "scroll-down", icon: <ArrowDownIcon />, label: "Scroll Down" },
          { m: "delay", icon: <AccessTimeIcon />, label: "Delay" },
          { m: "crop", icon: <CropIcon />, label: "Add Context" },
          { m: "generate-steps", icon: <AutoAwesomeIcon />, label: "Generate Steps" }


        ] as { m: string; icon: JSX.Element; label: string }[]).map(({ m, icon, label }) => {
          const active = mode === m;

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
              title={label}
              aria-pressed={active}
              className={`toolbar-button ${active ? 'toolbar-button-active' : ''}`}
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