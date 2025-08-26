// src/components/RemoteRunner.tsx
import React, { useRef, useState } from "react";
import { useInsight } from "@semoss/sdk-react";
import { runPixel } from "@semoss/sdk";

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

export default function RemoteRunner() {
  const [sessionId, setSessionId] = useState<any>();
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [url, setUrl] = useState("https://example.com");
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const { insightId } = useInsight();

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1
  };

  async function createSession() {

    let pixel = `Playwright ( endpoint = [ "session" ] , paramValues = [ {"url":"${url}", "width": 1280, "height": 800, "deviceScaleFactor": 1} ] )`;
    const res = await runPixel(pixel, insightId);
    const { output } = await res.pixelReturn[0] as { output: { sessionId: string, firstShot: ScreenshotResponse } };

    setSessionId(output['sessionId']);
    setShot(output['firstShot']);
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

    let pixel = `Playwright ( endpoint = [ "step" ] , sessionId = "${sessionId}", paramValues = [ ${JSON.stringify(step)} ] )`;
    const res = await runPixel(pixel, insightId);

    const { output } = res.pixelReturn[0];

    const data: ScreenshotResponse = output as ScreenshotResponse;
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
    // const res = await fetch(`${API}/${sessionId}/replay`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ steps: envelope })
    // });

    let pixel = `Playwright ( endpoint = [ "replay" ] , sessionId = "${sessionId}", paramValues = [  "steps": {${envelope}} ] )`;
    const res = await runPixel(pixel, insightId);

    // const res = await fetch(`${API}/engine/runPixel`, {
    //   method: "POST",
    //   headers: { 
    //     "Content-Type": "application/json" 
    //   },
    //   body: JSON.stringify({ 
    //     expression: `Playwright ( endpoint = [ "replay" ] , sessionId = "${sessionId}", paramValues = [  "steps": {${envelope}} ] )`,
    //     insightId: insightId
    //   })
    // });
    
    const data: ScreenshotResponse = await res.pixelReturn[0].output as ScreenshotResponse;
    setShot(data);
  }
const [scriptName, setScriptName] = useState("script-1");

async function save() {
  if (!sessionId) return;
  const name = window.prompt("Save as (name or filename.json):", scriptName) || scriptName;

  let pixel = `Playwright ( endpoint = [ "save" ] , sessionId = "${sessionId}", paramValues = [  {"name": "${name}"} ] )`;
  const res = await runPixel(pixel, insightId);
  const data = await res.pixelReturn[0].output as { file: string };

  setScriptName(name);
  alert(`Saved to: ${data.file}`);
}

async function replayFromFile() {
  if (!sessionId) return;
  const name = window.prompt("Replay file (name in 'recordings' or absolute path):", scriptName) || scriptName;

  let pixel = `Playwright ( endpoint = [ "replayFile" ] , sessionId = "${sessionId}", paramValues = [ { "name" : "${name}"} ] )`;
  const res = await runPixel(pixel, insightId);

  const { output } = res.pixelReturn[0] as { output: any };

  if (output && typeof output === 'object' && output.base64Png) {
    setShot(output as ScreenshotResponse);
  } else {
    console.error("Invalid response structure:", output);
    alert("Error: Invalid response from replayFile endpoint");
  }
}

return (
  <div style={{ padding: 16 }}>
    <h2>Remote Playwright Runner</h2>
    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
      <input value={url} onChange={e => setUrl(e.target.value)} style={{ width: 420 }} />
      <button onClick={createSession}>Open</button>
      <button onClick={replay} disabled={!sessionId}>Replay (Current Steps)</button>
      <button onClick={save} disabled={!sessionId}>Save</button>
      <button onClick={replayFromFile} disabled={!sessionId}>Replay From File</button>
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