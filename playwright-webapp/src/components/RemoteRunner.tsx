// src/components/RemoteRunner.tsx
import React, { useRef, useState, useEffect } from "react";

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
  base64Png: string;          // normalized in normalizeShot()
  width: number;
  height: number;
  deviceScaleFactor: number;
};

type Coords = { x: number; y: number };
type Viewport = { width: number; height: number; deviceScaleFactor: number };

type Step =
  | { type: "NAVIGATE"; url: string; waitUntil?: "networkidle" | "domcontentloaded"; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "CLICK"; coords: Coords; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "TYPE"; coords: Coords; text: string; label?: string | null; pressEnter?: boolean; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "SCROLL"; coords: Coords; deltaY?: number; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT"; waitAfterMs: number; viewport: Viewport; timestamp: number }
  | { type: "SELECT_TEXT"; coords: Coords; text?: string | null; viewport: Viewport; waitAfterMs?: number; timestamp: number };

type StepsEnvelope = { version: "1.0"; steps: Step[] };
type ReplayStatus = { running: boolean; index: number; total: number; current?: string | null; error?: string | null };

// UI helper for editor
type EditableInput = { index: number; label: string; value: string };

const API = "http://localhost:8080/api/remote"; // adjust if needed

export default function RemoteRunner() {
  const [sessionId, setSessionId] = useState<string>();
  const [shot, setShot] = useState<ScreenshotResponse>();
  const [url, setUrl] = useState("https://example.com");
  const [steps, setSteps] = useState<Step[]>([]);
  const [selections, setSelections] = useState<SelectionResult[]>([]);
  const [mode, setMode] = useState<"click" | "select">("click");

  // Live polling controls
  const [live, setLive] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);

  // Inputs editor
  const [inputs, setInputs] = useState<EditableInput[]>([]);
  const [showInputs, setShowInputs] = useState(false);

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1
  };

  // ---------- helpers ----------
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

  async function fetchScreenshot() {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API}/${sessionId}/screenshot`, { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      const snap = normalizeShot(data);
      if (snap) setShot(snap);
    } catch (err) {
      console.error("fetchScreenshot error:", err);
    }
  }

  // --- Session management
  async function createSession() {
    try {
      const res = await fetch(`${API}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, width: 1280, height: 800, deviceScaleFactor: 1 })
      });
      if (!res.ok) {
        console.error("createSession failed", res.status, await res.text());
        alert("Failed to create session");
        return;
      }
      const data = await res.json();
      console.log("createSession response:", data);

      setSessionId(data.sessionId);

      // Try firstShot from server, else fallback to GET /screenshot
      const snap = normalizeShot(data.firstShot);
      if (snap) {
        setShot(snap);
      } else {
        console.warn("firstShot missing or malformed; fetching fallback screenshot");
        await fetchScreenshot();
      }

      // seed steps so replay matches
      setSteps([{
        type: "NAVIGATE",
        url,
        waitUntil: "networkidle",
        viewport,
        timestamp: Date.now()
      } as Step]);
    } catch (err) {
      console.error("createSession error:", err);
      alert("Error creating session; see console for details.");
    }
  }

  // --- Live polling of replay status (stop live when finished)
  useEffect(() => {
    if (!sessionId || !live) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`${API}/${sessionId}/replay/status`);
        if (r.ok) {
          const st: ReplayStatus = await r.json();
          if (!st.running) setLive(false); // stop live when replay finishes or fails
        }
      } catch (err) {
        console.warn("status poll error:", err);
      }
      if (!cancelled && live) setTimeout(poll, 500);
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, live]);

  // --- Live polling loop for screenshots (chain setTimeout to avoid overlap)
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

  // --- Send a step to the backend and advance to the returned screenshot
  async function sendStep(step: Step) {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API}/${sessionId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step })
      });
      if (!res.ok) {
        console.error("step failed", res.status, await res.text());
        alert("Step failed");
        return;
      }
      const data = await res.json();
      const snap = normalizeShot(data);
      if (snap) setShot(snap);
      setSteps(prev => [...prev, step]);
    } catch (err) {
      console.error("sendStep error:", err);
    }
  }

  async function waitAndShot() {
    if (!sessionId) return;
    const ms = Number(window.prompt("Wait how many ms?", "800")) || 800;
    const step: Step = { type: "WAIT", waitAfterMs: ms, viewport, timestamp: Date.now() };
    await sendStep(step); // server will wait + return a fresh screenshot
  }

  // --- Start async replay + go live
  async function startLiveReplay() {
    if (!sessionId) return;
    const envelope: StepsEnvelope = { version: "1.0", steps };
    const r = await fetch(`${API}/${sessionId}/replay/async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: envelope })
    });
    if (!r.ok) {
      console.error("startLiveReplay failed", r.status, await r.text());
      alert("Failed to start live replay");
      return;
    }
    setLive(true); // begin polling screenshots
  }

  // --- Map click on <img> to page CSS pixels using the clicked element
  function imageToPageCoords(e: React.MouseEvent<HTMLImageElement>): Coords {
    if (!shot) return { x: 0, y: 0 };
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const scaleX = shot.width / rect.width;
    const scaleY = shot.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return { x: Math.round(x), y: Math.round(y) };
  }

  // --- Handle click on the screenshot (mode-aware)
  async function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!shot) return;
    const coords = imageToPageCoords(e);

    const modifierSelecting = e.altKey || e.shiftKey;
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
      await getSelections();
      return;
    }

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

  // --- Replay current in-memory steps (blocking)
  async function replay() {
    if (!sessionId) return;
    const envelope: StepsEnvelope = { version: "1.0", steps };
    const res = await fetch(`${API}/${sessionId}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: envelope })
    });
    if (!res.ok) {
      console.error("replay failed", res.status, await res.text());
      alert("Replay failed");
      return;
    }
    const data = await res.json();
    const snap = normalizeShot(data);
    if (snap) setShot(snap);
  }

  // --- Save current history to a file on the server
  const [scriptName, setScriptName] = useState("script-1");
  async function save() {
    if (!sessionId) return;
    const name = window.prompt("Save as (name or filename.json):", scriptName) || scriptName;
    const res = await fetch(`${API}/${sessionId}/save?name=${encodeURIComponent(name)}`, { method: "POST" });
    if (!res.ok) {
      console.error("save failed", res.status, await res.text());
      alert("Save failed");
      return;
    }
    const data = await res.json();
    setScriptName(name);
    alert(`Saved to: ${data.file}`);
  }

  // --- Replay directly from a saved file (server-side)
  async function replayFromFile() {
    if (!sessionId) return;
    const name = window.prompt("Replay file (name in 'recordings' or absolute path):", scriptName) || scriptName;
    const res = await fetch(`${API}/${sessionId}/replay/file?name=${encodeURIComponent(name)}`, { method: "POST" });
    if (!res.ok) {
      console.error("replayFromFile failed", res.status, await res.text());
      alert("Replay from file failed");
      return;
    }
    const data = await res.json();
    const snap = normalizeShot(data);
    if (snap) setShot(snap);
  }

  // --- Selection APIs
  async function getSelections() {
    if (!sessionId) return;
    const res = await fetch(`${API}/${sessionId}/selections`, { method: "GET" });
    if (!res.ok) { alert("Failed to fetch selections"); return; }
    const data: SelectionsResponse = await res.json();
    setSelections(data.items || []);
  }

  async function clearSelections() {
    if (!sessionId) return;
    const ok = confirm("Clear all selections for this session?");
    if (!ok) return;
    const res = await fetch(`${API}/${sessionId}/selections`, { method: "DELETE" });
    if (!res.ok) { alert("Failed to clear selections"); return; }
    setSelections([]);
  }

  // ---- Inputs editor helpers
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
    if (!res.ok) {
      console.error("replayWith failed", res.status, await res.text());
      alert("Replay failed");
      return;
    }
    const data = await res.json();
    const snap = normalizeShot(data);
    if (snap) setShot(snap);
  }

  // ---- Load a recording file and open the editor
  async function loadRecordingFromServer() {
    const name = window.prompt("Recording name in 'recordings' (or filename.json):", "script-1") || "script-1";
    const res = await fetch(`${API}/recordings/get?name=${encodeURIComponent(name)}`);
    if (!res.ok) { alert("Failed to load recording"); return; }
    const data: StepsEnvelope = await res.json();

    const loadedSteps = data.steps || [];
    setSteps(loadedSteps);
    setInputs(buildInputsFrom(loadedSteps));
    setShowInputs(true);
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Remote Playwright Runner</h2>

      {/* toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input value={url} onChange={e => setUrl(e.target.value)} style={{ width: 420 }} />
        <button onClick={createSession}>Open</button>

        {/* Recording controls */}
        <button onClick={waitAndShot} disabled={!sessionId}>Wait (ms) + Shot</button>
        <button onClick={replay} disabled={!sessionId}>Replay (blocking)</button>
        <button onClick={save} disabled={!sessionId}>Save</button>
        <button onClick={replayFromFile} disabled={!sessionId}>Replay From File</button>

        {/* Selections + select mode */}
        <button onClick={() => setMode(m => (m === "click" ? "select" : "click"))} disabled={!sessionId}>
          {mode === "select" ? "Selecting… (click image)" : "Select Text Mode"}
        </button>
        <button onClick={getSelections} disabled={!sessionId}>Get Selections</button>
        <button onClick={clearSelections} disabled={!sessionId || selections.length === 0}>Clear Selections</button>

        {/* Editing inputs & loading recordings */}
        <button onClick={loadRecordingFromServer}>Load Recording (Edit)</button>
        <button onClick={() => { setInputs(buildInputsFrom(steps)); setShowInputs(true); }} disabled={steps.length === 0}>
          Edit Inputs
        </button>

        {/* Live replay controls */}
        <button onClick={startLiveReplay} disabled={!sessionId || steps.length === 0}>Start Live Replay</button>
        <button onClick={() => setLive(v => !v)} disabled={!sessionId}>
          {live ? "Stop Live" : "Start Live (just poll)"}
        </button>
        <label>
          Interval:&nbsp;
          <input
            type="number"
            min={250}
            step={250}
            value={intervalMs}
            onChange={e => setIntervalMs(Math.max(250, Number(e.target.value) || 1000))}
            style={{ width: 90 }}
          /> ms
        </label>

        <span>Steps: {steps.length}</span>
      </div>

      {shot && (
        <>
          <img
            onClick={handleClick}
            src={shot?.base64Png ? `data:image/png;base64,${shot.base64Png}` : undefined}
            alt="remote"
            style={{
              border: "1px solid #ccc",
              maxWidth: "100%",
              cursor: mode === "select" ? "text" : "crosshair"
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
              {inputs.map((it) => (
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
            {/* Run With These */}
            <button
              onClick={async () => {
                const next = applyInputsTo(steps, inputs);
                setSteps(next);
                await replayWith(next);
                setShowInputs(false);
              }}
            >
              Run With These
            </button>
            <button onClick={() => setShowInputs(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
