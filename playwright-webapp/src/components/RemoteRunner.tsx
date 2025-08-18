// src/components/RemoteRunner.tsx
import React, { useRef, useState } from "react";

type SelectionResult = {
  label?: string | null;
  text: string;
  word: string;
  selector: string;
  tag: string;
  href?: string | null;
  timestamp: number;
};

type SelectionsResponse = { items: SelectionResult[] };

type ScreenshotResponse = {
  base64Png: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
};

type Coords = { x: number; y: number };
type Viewport = { width: number; height: number; deviceScaleFactor: number };

type Step =
  | { type: "NAVIGATE"; url: string; waitUntil?: "networkidle" | "domcontentloaded"; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "CLICK"; coords: Coords; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "TYPE"; coords: Coords; text: string; label?: string | null; pressEnter?: boolean; viewport: Viewport; waitAfterMs?: number; timestamp: number } // ← label added
  | { type: "SCROLL"; coords: Coords; deltaY?: number; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT"; waitAfterMs: number; viewport: Viewport; timestamp: number }
  | { type: "SELECT_TEXT"; coords: Coords; text?: string | null; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT_FOR_USER"; label?: string | null; viewport: Viewport; waitAfterMs?: number; timestamp: number };


type StepsEnvelope = { version: "1.0"; steps: Step[] };

type ReplayFrame = {
  shot: ScreenshotResponse;
  paused: boolean;
  pauseLabel?: string | null;
  cursor: number;
  done: boolean;
};

const API = "http://localhost:8080/api/remote"; // adjust

export default function RemoteRunner() {
  const [sessionId, setSessionId] = useState<string>();
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [url, setUrl] = useState("https://example.com");
  const [steps, setSteps] = useState<Step[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [selections, setSelections] = useState<SelectionResult[]>([]);
  const [mode, setMode] = useState<"click" | "select">("click");
  const [inputs, setInputs] = useState<EditableInput[]>([]);
  const [frame, setFrame] = useState<ReplayFrame | null>(null);


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

  async function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);

    // Allow a "temporary" select via Alt/Option or Shift without toggling the button
    const modifierSelecting = e.altKey || e.shiftKey; // React exposes these in the event
    const isSelect = mode === "select" || modifierSelecting;

    if (isSelect) {
      const label = window.prompt("Label for this selection? (optional)", "") || null;
      const step: Step = {
        type: "SELECT_TEXT",
        coords,
        text: label,
        viewport,
        waitAfterMs: 0,
        timestamp: Date.now()
      };
      await sendStep(step);
      // (Optional) auto-refresh selections list
      await getSelections();
      return;
    }

    // --- existing flow for normal actions ---
    const action = window.prompt("Action? (click/type/scroll)", "click");
    if (!action) return;

    if (action === "click") {
      await sendStep({ type: "CLICK", coords, viewport, waitAfterMs: 300, timestamp: Date.now() });
    } else if (action === "type") {
      const text = window.prompt("Text to type:", "") ?? "";
      const label = window.prompt("Optional label for this input (e.g., username, orderId):", "") || null;
      const pressEnter = window.confirm("Press Enter after typing?");
      await sendStep({
        type: "TYPE",
        coords, text, label, pressEnter,
        viewport, waitAfterMs: 300, timestamp: Date.now()
      } as Step);
    } else if (action === "scroll") {
      await sendStep({ type: "SCROLL", coords, deltaY: 400, viewport, waitAfterMs: 300, timestamp: Date.now() });
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
  const [scriptName, setScriptName] = useState("script-1");

  async function save() {
    if (!sessionId) return;
    const name = window.prompt("Save as (name or filename.json):", scriptName) || scriptName;
    const res = await fetch(`${API}/${sessionId}/save?name=${encodeURIComponent(name)}`, {
      method: "POST"
    });
    const data = await res.json();
    setScriptName(name);
    alert(`Saved to: ${data.file}`);
  }

  async function replayFromFile() {
    if (!sessionId) return;
    const name = window.prompt("Replay file (name in 'recordings' or absolute path):", scriptName) || scriptName;
    const res = await fetch(`${API}/${sessionId}/replay/file?name=${encodeURIComponent(name)}`, {
      method: "POST"
    });
    const data: ScreenshotResponse = await res.json();
    setShot(data);
  }

  async function getSelections() {
    if (!sessionId) return;
    const res = await fetch(`${API}/${sessionId}/selections`, { method: "GET" });
    if (!res.ok) {
      alert("Failed to fetch selections");
      return;
    }
    const data: SelectionsResponse = await res.json();
    setSelections(data.items || []);
  }

  async function clearSelections() {
    if (!sessionId) return;
    const ok = confirm("Clear all selections for this session?");
    if (!ok) return;
    const res = await fetch(`${API}/${sessionId}/selections`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to clear selections");
      return;
    }
    setSelections([]);
  }

  const [showInputs, setShowInputs] = useState(false);
  type EditableInput = { index: number; label: string; value: string };

  function gatherInputs(): EditableInput[] {
    return steps
      .map((st, i) => st.type === "TYPE" ? ({ index: i, label: (st.label ?? `input-${i}`), value: st.text }) : null)
      .filter((x): x is EditableInput => !!x);
  }

  async function loadRecordingFromServer() {
    const name = window.prompt("Recording name in 'recordings' (or filename.json):", "script-1") || "script-1";
    const res = await fetch(`${API}/recordings/get?name=${encodeURIComponent(name)}`);
    if (!res.ok) { alert("Failed to load recording"); return; }
    const data: StepsEnvelope = await res.json();

    const loadedSteps = data.steps || [];
    setSteps(loadedSteps);
    setInputs(buildInputsFrom(loadedSteps));  // <-- build from the data you JUST fetched
    setShowInputs(true);
  }


  function buildInputsFrom(arr: Step[]): EditableInput[] {
    return (arr ?? [])
      .map((st, i) =>
        st.type === "TYPE" ? { index: i, label: st.label ?? `input-${i}`, value: st.text } : null
      )
      .filter((x): x is EditableInput => !!x);
  }

  function applyInputsTo(stepsArr: Step[], edits: EditableInput[]): Step[] {
    const map = new Map(edits.map(e => [e.index, e]));
    return stepsArr.map((st, i) => {
      const e = map.get(i);
      if (!e || st.type !== "TYPE") return st;
      return { ...st, label: e.label, text: e.value } as Step;
    });
  }

  async function replayWith(stepsToRun: Step[]) {
    if (!sessionId) return;
    const envelope: StepsEnvelope = { version: "1.0", steps: stepsToRun };
    const res = await fetch(`${API}/${sessionId}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: envelope })
    });
    const data: ScreenshotResponse = await res.json();
    setShot(data);
  }

  async function insertPause() {
    const label = window.prompt("Pause label (e.g., 'Enter OTP on phone'):", "Enter OTP") || null;
    const pauseStep: Step = { type: "WAIT_FOR_USER", label, viewport, timestamp: Date.now(), waitAfterMs: 0 };
    setSteps(prev => [...prev, pauseStep]);
    // Optional: send to backend to record in history now
    if (sessionId) {
      await fetch(`${API}/${sessionId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: pauseStep })
      });
    }
  }

  async function runUntilPause() {
    if (!sessionId) return;
    const envelope: StepsEnvelope = { version: "1.0", steps };
    const res = await fetch(`${API}/${sessionId}/replay/run`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope)
    });
    const data: ReplayFrame = await res.json();
    setShot(data.shot);
    setFrame(data);
    if (data.paused && data.pauseLabel) {
      alert(`Paused: ${data.pauseLabel}\nYou can type steps, approve on phone, etc., then click Continue.`);
    }
  }

  async function continueRun() {
    if (!sessionId) return;
    const res = await fetch(`${API}/${sessionId}/replay/continue`, { method: "POST" });
    const data: ReplayFrame = await res.json();
    setShot(data.shot);
    setFrame(data);
    if (data.paused && data.pauseLabel) {
      alert(`Paused: ${data.pauseLabel}`);
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
        <button onClick={() => setMode(m => (m === "click" ? "select" : "click"))} disabled={!sessionId}>
          {mode === "select" ? "Selecting… (click image)" : "Select Text Mode"}
        </button>
        <button onClick={getSelections} disabled={!sessionId}>Get Selections</button>
        <button onClick={clearSelections} disabled={!sessionId || selections.length === 0}>Clear Selections</button>
        <button onClick={loadRecordingFromServer} disabled={!sessionId}>Load Recording (Edit)</button>
        <button onClick={() => { setInputs(gatherInputs()); setShowInputs(true); }} disabled={!sessionId}>
          Edit Inputs
        </button>
        <button onClick={insertPause} disabled={!sessionId}>Insert Pause (Wait for User)</button>
        <button onClick={runUntilPause} disabled={!sessionId}>Run (Until Pause)</button>
        <button onClick={continueRun} disabled={!sessionId || !frame?.paused}>Continue</button>
        <span>Steps: {steps.length}</span>
      </div>

      {shot && (
        <>

          <img
            ref={imgRef}
            onClick={handleClick}
            src={`data:image/png;base64,${shot.base64Png}`}
            alt="remote"
            style={{
              border: "1px solid #ccc",
              maxWidth: "100%",
              cursor: mode === "select" ? "text" : "crosshair"   // <-- change cursor
            }}
          />
          {selections.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4>Selections ({selections.length})</h4>
              <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #ddd", padding: 8 }}>
                {selections.map((s, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px dashed #eee" }}>
                    <div><strong>Label:</strong> {s.label ?? "-"}</div>
                    <div><strong>Word:</strong> {s.word || "-"}</div>
                    <div><strong>Text:</strong> {s.text || "-"}</div>
                    <div><strong>Tag:</strong> {s.tag} {s.href ? (<a href={s.href} target="_blank" rel="noreferrer">({s.href})</a>) : null}</div>
                    <div><strong>Selector:</strong> <code>{s.selector}</code></div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      {new Date(s.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}


      {showInputs && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h4>Edit Inputs ({inputs.length})</h4>
          {inputs.length === 0 ? <div>No TYPE steps found.</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>Idx</div>
              <div style={{ fontWeight: 600 }}>Label</div>
              <div style={{ fontWeight: 600 }}>Value</div>
              <div />
              {inputs.map((it, row) => (
                <React.Fragment key={it.index}>
                  <div>#{it.index}</div>
                  <input
                    value={it.label}
                    onChange={e => setInputs(cur => cur.map(c => c.index === it.index ? { ...c, label: e.target.value } : c))}
                  />
                  <input
                    value={it.value}
                    onChange={e => setInputs(cur => cur.map(c => c.index === it.index ? { ...c, value: e.target.value } : c))}
                  />
                  <button onClick={() => setInputs(cur => cur.filter(c => c.index !== it.index))}>Remove</button>
                </React.Fragment>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            // Run With These
            <button onClick={async () => {
              const next = applyInputsTo(steps, inputs); // compute
              setSteps(next);                             // update state for the UI
              await replayWith(next);                     // run with the computed array (no race)
              setShowInputs(false);
            }}>
              Run With These
            </button>
            <button onClick={() => setShowInputs(false)}>Cancel</button>

          </div>
        </div>
      )}

    </div>

  );
}