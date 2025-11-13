import type { StepsBottomSectionProps, Viewport, PageData } from "../../types";
import { runPixel } from "@semoss/sdk";
import './StepsBottomSection.css';
import { useSendStep } from "../../hooks/useSendStep";
import { preferSelectorFromProbe } from "../../hooks/usePreferSelector";
import { useProbeAt } from "../../hooks/useProbeAt";
import { useState, useEffect, useRef } from "react";
import { PlayArrow, ChevronRight, ExpandMore } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';

function StepsBottomSection(props: StepsBottomSectionProps) {
  const {
    overlay, setOverlay, sessionId, selectedRecording,
    setLoading, insightId, setShot,
    steps, setSteps, shot, activeTabId, tabs, setTabs, setActiveTabId,
    setCurrentCropArea, setVisionPopup, setMode, setCrop, imgRef
  } = props

  const [loadingSteps, setLoadingSteps] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set([0]));
  const [executingStepId, setExecutingStepId] = useState<number | null>(null);
  const [showStepsList, setShowStepsList] = useState(false);
  const [allStepsByTab, setAllStepsByTab] = useState<Record<string, PageData[]>>({});
  const [currentTabSteps, setCurrentTabSteps] = useState<PageData[]>([]);
  const [executedSteps, setExecutedSteps] = useState<Set<number>>(new Set());
  const [errorSteps, setErrorSteps] = useState<Set<number>>(new Set());
  const [isExecutingAll, setIsExecutingAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const { sendStep } = useSendStep({
    insightId: insightId,
    sessionId: sessionId,
    shot: shot,
    setShot: setShot,
    steps: steps,
    setSteps: setSteps,
    setLoading: setLoading
  });

  const viewport: Viewport = {
    width: shot?.width ?? 1280,
    height: shot?.height ?? 800,
    deviceScaleFactor: shot?.deviceScaleFactor ?? 1,
  };

  useEffect(() => {
    if (selectedRecording) {
      setLoadingSteps(true);
      setAllStepsByTab({});
      setCurrentTabSteps([]);
      setShowStepsList(false);
      loadAllSteps();
    }
  }, [selectedRecording]);

  useEffect(() => {
    if (allStepsByTab[activeTabId]) {
      setCurrentTabSteps(allStepsByTab[activeTabId]);
    }
  }, [activeTabId, allStepsByTab]);

  const loadAllSteps = async () => {

    try {
      const pixel = `GetAllSteps(sessionId="${sessionId}", fileName="${selectedRecording}");`;
      const res = await runPixel(pixel, insightId);
      const output = res.pixelReturn[0].output as {
        success: boolean;
        steps: Record<string, any[]>;
      };

      if (output.success && output.steps) {
        // Process steps for ALL tabs at once
        const stepsByTab: Record<string, PageData[]> = {};

        for (const [tabId, tabSteps] of Object.entries(output.steps)) {
          const pages: PageData[] = [];
          let currentPage: any[] = [];
          let pageIndex = 0;

          tabSteps.forEach((step: any) => {
            if (step.type === 'NAVIGATE' && currentPage.length > 0) {
              pages.push({ pageIndex, steps: currentPage });
              pageIndex++;
              currentPage = [step];
            } else {
              currentPage.push(step);
            }
          });

          if (currentPage.length > 0) {
            pages.push({ pageIndex, steps: currentPage });
          }

          stepsByTab[tabId] = pages;
        }

        setAllStepsByTab(stepsByTab);
        setCurrentTabSteps(stepsByTab[activeTabId] || []);
        setShowStepsList(true);
      }
    } catch (err) {
      console.error('Failed to load steps:', err);
    } finally {
      setLoadingSteps(false);
    }

  };

  const handleExecuteAllClick = () => {
    // Start fresh
    if (!isExecutingAll && !isPaused) {
      setIsPaused(false);
      setIsExecutingAll(true);
      executeAllStepsLoop();
      return;
    }

    // Currently executing → Pause
    if (isExecutingAll && !isPaused) {
      setIsPaused(true);          // loop sees isPausedRef and returns
      // ❌ remove this: setIsExecutingAll(false);
      return;
    }

    // Paused → Continue
    if (!isExecutingAll && isPaused) {
      setIsPaused(false);
      setIsExecutingAll(true);
      executeAllStepsLoop();      // continues from remaining steps
    }
  };

  const executeSingleStep = async (
    stepId: number
  ): Promise<{ requestedPause: boolean }> => {
    setExecutingStepId(stepId);
    setLoading(true);

    try {
      // 1) Find the step (search all tabs)
      let stepData: any = null;
      let stepTabId: string = activeTabId;

      for (const [tabId, pages] of Object.entries(allStepsByTab)) {
        for (const page of pages) {
          const found = page.steps.find((s: any) => s.id === stepId);
          if (found) {
            stepData = found;
            stepTabId = tabId;
            break;
          }
        }
        if (stepData) break;
      }

      if (!stepData) {
        console.error("Step not found:", stepId);
        return { requestedPause: false };
      }

      const actionTabId = stepTabId || activeTabId || "tab-1";

      // 2) Handle CONTEXT steps (show crop overlay)
      if (stepData.type === "CONTEXT") {
        const coords = stepData.multiCoords;

        if (coords && coords.length >= 2) {
          const imgRect = imgRef?.current?.getBoundingClientRect();

          const displayWidth = imgRect?.width ?? 1280;
          const displayHeight = imgRect?.height ?? 800;
          const screenshotWidth = 1280;
          const screenshotHeight = 800;

          const scaleX = displayWidth / screenshotWidth;
          const scaleY = displayHeight / screenshotHeight;

          const scaled = coords.map((c: any) => ({
            x: Math.round(c.x * scaleX),
            y: Math.round(c.y * scaleY),
          }));

          setCurrentCropArea({
            startX: scaled[0].x,
            startY: scaled[0].y,
            endX: scaled[1].x,
            endY: scaled[1].y,
          });

          setVisionPopup({
            x: scaled[1].x,
            y: scaled[0].y,
            query: stepData.prompt,
            response: null,
          });
          setMode("crop");

          setCrop({
            unit: "px",
            x: scaled[0].x,
            y: scaled[0].y,
            width: scaled[1].x - scaled[0].x,
            height: scaled[1].y - scaled[0].y,
          });
        }

        // Mark as executed
        setExecutedSteps((prev) => new Set([...prev, stepId]));
        setErrorSteps((prev) => {
          const newSet = new Set(prev);
          newSet.delete(stepId);
          return newSet;
        });

        // (Optional) you could also setIsPaused(true) here if you want Execute-All
        // to wait until the crop interaction is done. For now we don't pause:
        return { requestedPause: false };
      }

      // 3) Handle TYPE steps that require overlay
      if (stepData.type === "TYPE" && stepData.storeValue && !overlay) {
        console.log("TYPE step requires input, showing overlay");

        // fetch the probe data if not already present
        let probeData = stepData.probe;
        if (!probeData && stepData.coords) {
          try {
            probeData = await useProbeAt(
              stepData.coords,
              sessionId,
              insightId,
              actionTabId
            );
          } catch (err) {
            console.error("Failed to probe element:", err);
          }
        }

        setOverlay({
          kind: "input",
          probe: { ...probeData },
          draftValue: stepData.text || "",
          draftLabel: stepData.label,
        });

        // We don't pause the loop automatically here; Execute-All can just continue.
        return { requestedPause: false };
      }

      // 4) If no recording file, execute directly via sendStep
      if (!selectedRecording) {
        console.log("Executing step directly via sendStep");

        try {
          if (stepData.type === "CLICK") {
            const p = await useProbeAt(
              stepData.coords,
              sessionId,
              insightId,
              actionTabId
            );
            await sendStep(
              {
                type: "CLICK",
                coords: stepData.coords,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 1000,
                selector: preferSelectorFromProbe(p) || {
                  strategy: "css",
                  value: "body",
                },
              },
              actionTabId
            );
          } else if (stepData.type === "TYPE") {
            const text = overlay?.draftValue ?? stepData.text;
            await sendStep(
              {
                type: "TYPE",
                coords: stepData.coords || { x: 0, y: 0 },
                text: text,
                label: stepData.label,
                isPassword: stepData.isPassword || false,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 1000,
                storeValue: false,
                selector:
                  preferSelectorFromProbe(stepData.probe) ?? {
                    strategy: "css",
                    value: "body",
                  },
              },
              actionTabId
            );
          } else if (stepData.type === "SCROLL") {
            await sendStep(
              {
                type: "SCROLL",
                coords: { x: 0, y: 0 },
                deltaY: stepData.deltaY,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 500,
              },
              actionTabId || "tab-1"
            );
          } else if (stepData.type === "WAIT") {
            // Local WAIT: just delay on the frontend
            await new Promise((resolve) =>
              setTimeout(resolve, stepData.waitAfterMs || 1000)
            );
          } else if (stepData.type === "NAVIGATE") {
            await sendStep(
              {
                type: "NAVIGATE",
                url: stepData.url,
                viewport,
                timestamp: Date.now(),
                waitAfterMs: 2000,
              },
              actionTabId
            );
          }

          // Mark as executed successfully
          setExecutedSteps((prev) => new Set([...prev, stepId]));
          setErrorSteps((prev) => {
            const newSet = new Set(prev);
            newSet.delete(stepId);
            return newSet;
          });

          setOverlay(null);

          return { requestedPause: false };
        } catch (err) {
          console.error("Step execution failed:", err);
          setErrorSteps((prev) => new Set([...prev, stepId]));
          alert("Step execution failed: " + err);
          return { requestedPause: false };
        }
      }

      // 5) Execute via ReplaySingleStep reactor (recording path)
      console.log("Executing step via ReplaySingleStep pixel");
      let pixel: string;

      if (stepData.type === "TYPE") {
        let paramValues: Record<string, string> | undefined = undefined;
        if (overlay?.draftValue !== undefined) {
          paramValues = { [stepData.label]: overlay.draftValue };
        } else if (stepData.text) {
          paramValues = { [stepData.label]: stepData.text };
        }

        if (paramValues) {
          pixel = `ReplaySingleStep(sessionId="${sessionId}", fileName="${selectedRecording}", stepId=${stepId}, tabId="${actionTabId}", paramValues=[${JSON.stringify(
            paramValues
          )}]);`;
        } else {
          pixel = `ReplaySingleStep(sessionId="${sessionId}", fileName="${selectedRecording}", stepId=${stepId}, tabId="${actionTabId}");`;
        }
        setOverlay(null);
      } else {
        pixel = `ReplaySingleStep(sessionId="${sessionId}", fileName="${selectedRecording}", stepId=${stepId}, tabId="${actionTabId}");`;
      }

      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0] as { output: any };

      console.log("ReplaySingleStep output:", output);

      // Check for errors
      if (output.status === "failed" || output.error) {
        console.error("Step execution failed:", output.error);
        setErrorSteps((prev) => new Set([...prev, stepId]));
        alert("Step execution failed: " + output.error);
        return { requestedPause: false };
      }

      // 🔴 IMPORTANT: if backend says shouldStop, pause immediately
      if (output.shouldStop === true) {
        // Mark as executed successfully
        setExecutedSteps((prev) => new Set([...prev, stepId]));
        setErrorSteps((prev) => {
          const newSet = new Set(prev);
          newSet.delete(stepId);
          return newSet;
        });

        // Set paused so UI can show "Continue"
        setIsPaused(true);

        // Update screenshot if provided
        if (output.screenshot) {
          setShot(output.screenshot);
        }

        // Tell the Execute-All loop to stop right now
        return { requestedPause: true };
      }

      // Check if this action opened a new tab
      const isNewTab = output.isNewTab;
      const newTabId = output.newTabId;
      const tabTitle = output.tabTitle;

      if (isNewTab && newTabId && tabs && setTabs && setActiveTabId) {
        console.log("New tab detected:", newTabId, tabTitle);

        const tabExists = tabs.find((t) => t.id === newTabId);

        setTabs((prevTabs) => {
          const updatedTabs = prevTabs.map((tab) => {
            if (tab.id === newTabId) {
              return {
                id: newTabId,
                title: tabTitle || newTabId,
                actions: [],
              };
            }
            return tab;
          });

          if (!tabExists) {
            updatedTabs.push({
              id: newTabId,
              title: tabTitle || newTabId,
              actions: [],
            });
          }

          return updatedTabs;
        });

        setActiveTabId(newTabId);
        console.log("Switched to tab:", newTabId);
      }

      // Update screenshot
      if (output.screenshot) {
        setShot(output.screenshot);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Mark as executed successfully
      setExecutedSteps((prev) => new Set([...prev, stepId]));
      setErrorSteps((prev) => {
        const newSet = new Set(prev);
        newSet.delete(stepId);
        return newSet;
      });

      return { requestedPause: false };
    } catch (err) {
      console.error("Step execution failed:", err);
      setErrorSteps((prev) => new Set([...prev, stepId]));
      alert("Step execution failed: " + err);
      return { requestedPause: false };
    } finally {
      setExecutingStepId(null);
      setLoading(false);
    }
  };

  const executePageSteps = async (pageIndex: number) => {
    const page = currentTabSteps[pageIndex];
    if (!page) return;

    setLoading(true);
    for (const step of page.steps) {
      // Skip already executed steps
      if (executedSteps.has(step.id)) {
        console.log("Skipping already executed step:", step.id);
        continue;
      }
      await executeSingleStep(step.id);
    }
    setLoading(false);

  };

  const executeAllStepsLoop = async (): Promise<void> => {
    setLoading(true);
    try {
      for (const page of currentTabSteps) {
        for (const step of page.steps) {
          // If user manually paused, stop immediately
          if (isPausedRef.current) {
            return;   // no more ReplaySingleStep
          }

          // Skip already executed steps
          if (executedSteps.has(step.id)) {
            continue;
          }

          const { requestedPause } = await executeSingleStep(step.id);

          if (requestedPause) {
            // Backend told us to stop (shouldStop === true)
            // EXIT RIGHT HERE: no next step runs
            return;
          }
        }
      }

      // finished everything normally → we're not paused anymore
      setIsPaused(false);
    } finally {
      setLoading(false);
      setIsExecutingAll(false);   // ✅ always reset when loop ends (even on pause)
    }
  };

  const togglePageExpansion = (pageIndex: number) => {
    setExpandedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageIndex)) {
        newSet.delete(pageIndex);
      } else {
        newSet.add(pageIndex);
      }
      return newSet;
    });
  };

  const getStepLabel = (step: any) => {
    switch (step.type) {
      case 'NAVIGATE':
        return `Navigate to ${step.url} `;
      case 'CLICK':
        return `Click at(${step.coords?.x}, ${step.coords?.y})`;
      case 'TYPE':
        return `Type: ${step.label || 'text'} `;
      case 'SCROLL':
        return `Scroll ${step.deltaY} px`;
      case 'WAIT':
        return 'Wait';
      default:
        return step.type;
    }
  };

  // const showHighlight = (x: number, y: number) => {
  //   setHighlight({ x, y });
  //   setTimeout(() => setHighlight(null), 4000);
  // }

  return (
    <>
      {showStepsList && selectedRecording && (
        <div className="steps-list-sidebar">
          <div className="steps-list-header">
            <h3>All Steps</h3>
            <button onClick={handleExecuteAllClick} disabled={loadingSteps}>
              <PlayArrow fontSize="small" />
              {(!isExecutingAll && !isPaused) && 'Execute All'}
              {(isExecutingAll && !isPaused) && 'Pause'}
              {(!isExecutingAll && isPaused) && 'Continue'}
            </button>
          </div>

          {loadingSteps && <CircularProgress size={24} />}

          <div className="pages-list">
            {currentTabSteps.map((page, pageIdx) => (
              <div key={pageIdx} className="page-item">
                <div className="page-header" onClick={() => togglePageExpansion(pageIdx)}>
                  <div className="page-title">
                    {expandedPages.has(pageIdx) ? <ExpandMore /> : <ChevronRight />}
                    <span>Page {pageIdx + 1}</span>
                    <span className="step-count">({page.steps.length} steps)</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); executePageSteps(pageIdx); }}
                    disabled={loadingSteps}
                  >
                    <PlayArrow fontSize="small" />
                  </button>
                </div>

                {expandedPages.has(pageIdx) && (
                  <div className="steps-list">
                    {page.steps.map((step) => {
                      const isExecuted = executedSteps.has(step.id);
                      const hasError = errorSteps.has(step.id);

                      return (
                        <div
                          key={step.id}
                          className={`step-item ${executingStepId === step.id ? 'executing' : ''} ${isExecuted ? 'step-executed' : ''} ${hasError ? 'step-error' : ''}`}
                        >
                          <span className="step-id">#{step.id}</span>
                          <span className="step-label">{getStepLabel(step)}</span>
                          {executingStepId === step.id && <CircularProgress size={16} />}
                          <button
                            onClick={() => executeSingleStep(step.id)}
                            disabled={loadingSteps}
                          >
                            <PlayArrow fontSize="small" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div >
      )
      }
    </>
  );
}

export default StepsBottomSection;