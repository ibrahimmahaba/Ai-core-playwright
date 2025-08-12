// src/components/RemoteRunner.tsx
import React, { useEffect, useRef, useState } from "react";

type ScreenshotResponse = {
  base64Png: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
};

type Coords = { x: number; y: number };
type Viewport = { width: number; height: number; deviceScaleFactor: number };

type Step =
  | { type: "NAVIGATE"; url: string; waitUntil?: "networkidle"|"domcontentloaded"; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "CLICK"; coords: Coords; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "TYPE"; coords: Coords; text: string; pressEnter?: boolean; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "SCROLL"; coords: Coords; deltaY?: number; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT"; waitAfterMs: number; viewport: Viewport; timestamp: number };

type StepsEnvelope = { version: "1.0"; steps: Step[] };

const API = "http://localhost:8080/api/remote"; // adjust

export default function RemoteRunner() {
  const [sessionId, setSessionId] = useState<string>();
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [url, setUrl] = useState("https://example.com");
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1
  };

  async function createSession() {
    const res = await fetch(`${API}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, width: 1280, height: 800, deviceScaleFactor: 1 })
    });
    const data = await res.json();
    setSessionId(data.sessionId);
    setShot(data.firstShot);
    // Also push NAVIGATE step locally so replay matches
    setSteps([{
      type: "NAVIGATE",
      url,
      waitUntil: "networkidle",
      viewport,
      timestamp: Date.now()
    } as Step]);
  }

  async function sendStep(step: Step) {
    if (!sessionId) return;
    const res = await fetch(`${API}/${sessionId}/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step })
    });
    const data: ScreenshotResponse = await res.json();
    setShot(data);
    setSteps(prev => [...prev, step]);
  }

  function imageToPageCoords(e: React.MouseEvent<HTMLImageElement, MouseEvent>): Coords {
    const img = imgRef.current!;
    const rect = img.getBoundingClientRect();
    const scaleX = (shot!.width) / rect.width;
    const scaleY = (shot!.height) / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Round to int CSS pixels
    return { x: Math.round(x), y: Math.round(y) };
  }

  async function handleClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);

    const mode = window.prompt("Action? (click/type/scroll)", "click");
    if (!mode) return;

    if (mode === "click") {
      await sendStep({
        type: "CLICK",
        coords, viewport, waitAfterMs: 300, timestamp: Date.now()
      } as Step);
    } else if (mode === "type") {
      const text = window.prompt("Text to type:", "");
      const pressEnter = window.confirm("Press Enter after typing?");
      await sendStep({
        type: "TYPE",
        coords, text: text || "", pressEnter, viewport, waitAfterMs: 300, timestamp: Date.now()
      } as Step);
    } else if (mode === "scroll") {
      await sendStep({
        type: "SCROLL",
        coords, deltaY: 400, viewport, waitAfterMs: 300, timestamp: Date.now()
      } as Step);
    }
  }

  async function replay() {
    if (!sessionId) return;
    const envelope: StepsEnvelope = { version: "1.0", steps };
    const res = await fetch(`${API}/${sessionId}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: envelope })
    });
    const data: ScreenshotResponse = await res.json();
    setShot(data);
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Remote Playwright Runner</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} style={{ width: 420 }} />
        <button onClick={createSession}>Open</button>
        <button onClick={replay} disabled={!sessionId}>Replay Steps</button>
        <span>Steps: {steps.length}</span>
      </div>

      {shot && (
        <img
          ref={imgRef}
          onClick={handleClick}
          src={`data:image/png;base64,${shot.base64Png}`}
          alt="remote"
          style={{ border: "1px solid #ccc", maxWidth: "100%", cursor: "crosshair" }}
        />
      )}
    </div>
  );
}
