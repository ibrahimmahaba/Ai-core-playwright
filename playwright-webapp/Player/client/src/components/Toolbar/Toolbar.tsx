import {
    Mouse as MouseIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
    AccessTime as AccessTimeIcon,
    Sync as SyncIcon,
    CropFree as CropIcon, 
  } from "@mui/icons-material";
import { type JSX } from "react";
import { runPixel } from "@semoss/sdk";
import type { ToolbarProps, ScreenshotResponse, Step, Viewport } from "../../types";
import {useSendStep} from"../../hooks/useSendStep"

function Toolbar(props: ToolbarProps) {
    const { sessionId, insightId, shot, setShot, mode, setMode, steps, setSteps, setLoading} = props;

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
            let pixel = `Screenshot ( sessionId = "${sessionId}" )`;
            const res = await runPixel(pixel, insightId);
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
                } else {
                  setMode(m);
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
  )
}

export default Toolbar