import type { ScreenshotResponse, Step } from "../types";
import { runPixel } from "@semoss/sdk";
import { useSessionStore } from "../store/useSessionStore";
import { fetchScreenshot } from "./useFetchScreenshot";


export function useSendStep() {

  async function sendStep(step: Step, tabId?: string) {
    const { sessionId, insightId, setShot, tabs, setTabs, activeTabId, setActiveTabId, setLoading } = useSessionStore.getState();
    const currentTabId = tabId || activeTabId;

    if (!sessionId || !tabs) {
      console.warn("Cannot send step: session not initialized", { sessionId, tabs });
      return;
    }

    // Check if this is an update to an existing labeled input
    let isUpdate = false;
    let existingInputIndex = -1;
    let existingStepId: number | undefined;
    
    if (step.type === "TYPE" && step.label) {
      const currentTab = tabs.find(t => t.id === currentTabId);
      if (currentTab) {
        existingInputIndex = currentTab.steps.findIndex(
          s => s.type === "TYPE" && s.label === step.label
        );
        if (existingInputIndex !== -1) {
          isUpdate = true;
          existingStepId = currentTab.steps[existingInputIndex].id;
        }
      }
    }

    // For updates, include the existing step ID so backend knows which step to update
    const shouldStore = step.type === "TYPE" && step.storeValue;
    setLoading(true);

    try {
      let pixel: string;
      
      if (isUpdate && existingStepId !== undefined && step.type === "TYPE") {
        // UpdateStep reactor with batch format (single item array)
        const updatePayload = [{
          id: existingStepId,
          label: step.label || '',
          text: step.text,
          storeValue: shouldStore
        }];
        pixel = `UpdateStep ( sessionId = "${sessionId}", tabId = "${currentTabId}", inputs = ${JSON.stringify(updatePayload)} )`;
      } else {
        // Step reactor with full step data for new steps
        pixel = `Step ( sessionId = "${sessionId}", tabId="${currentTabId}", shouldStore = ${shouldStore}, paramValues = [ ${JSON.stringify(step)} ] )`;
      }
      
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0] as any;
      
      const data: ScreenshotResponse = output["screenshot"] as ScreenshotResponse;
      const isNewTab: boolean = output["isNewTab"] as boolean;
      const newTabId: string | undefined = output["newTabId"] as string | undefined;
      const tabTitle: string = output["tabTitle"] as string;
      const backendStepId: number = output["stepId"] as number; // Backend returns the step ID for new steps
      
      // Create the step with the backend-assigned ID (or keep existing ID for updates)
      const stepWithId = { ...step, id: isUpdate && existingStepId ? existingStepId : backendStepId };
      
      setShot(data);


      setTabs(prevTabs => {
        const updatedTabs = prevTabs.map(tab => {
          if (tab.id === currentTabId) {
            // If navigating, clear all TYPE steps (inputs) from the current tab
            const stepsToKeep = stepWithId.type === "NAVIGATE" 
              ? tab.steps.filter(s => s.type !== "TYPE")
              : tab.steps;
            
            // If this is an update to an existing labeled input
            if (isUpdate && existingInputIndex !== -1) {
              const updatedSteps = [...stepsToKeep];
              updatedSteps[existingInputIndex] = stepWithId;
              return {
                ...tab,
                steps: updatedSteps,
                title: tab.title
              };
            }
            
            // Add the new step (no duplicate found or not a labeled TYPE step)
            return {
              ...tab,
              steps: [...stepsToKeep, stepWithId],
              title: stepWithId.type === "NAVIGATE" && tabTitle ? tabTitle : tab.title
            };
          }
          return tab;
        });

        if (isNewTab && newTabId && !updatedTabs.find(t => t.id === newTabId)) {
          const newTab = {
            id: newTabId,
            title: tabTitle || newTabId,
            steps: []
          };
          return [...updatedTabs, newTab];
        }

        return updatedTabs;
      });

      if (isNewTab && newTabId) {
        setActiveTabId(newTabId);
      }
      
    } catch (error) {
      console.error("Error sending step:", error);
      console.error("Step details:", { step, isUpdate, sessionId, currentTabId });
      // Try to fetch screenshot even on error to avoid white screen
      try {
        const { sessionId, insightId, setShot } = useSessionStore.getState();
        await fetchScreenshot(sessionId, insightId, currentTabId, setShot);
      } catch (fetchError) {
        console.error("Failed to fetch screenshot after error:", fetchError);
      }
      // Re-throw the error so callers can handle it
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function updateSteps(
    updates: Array<{id?: number; label: string; text: string; storeValue: boolean}>, 
    tabId?: string
  ) {
    const { sessionId, insightId, setShot, setLoading, setTabs } = useSessionStore.getState();
    const currentTabId = tabId;

    if (!sessionId) {
      console.warn("Cannot update steps: session not initialized", { sessionId });
      return;
    }

    setLoading(true);

    try {
      // Call UpdateStep with batch of inputs
      const pixel = `UpdateStep ( sessionId = "${sessionId}", tabId = "${currentTabId}", inputs = ${JSON.stringify(updates)} )`;
      
      const res = await runPixel(pixel, insightId);
      const { output } = res.pixelReturn[0] as any;
      
      let data: ScreenshotResponse | undefined;
      try {
        data = output["screenshot"] as ScreenshotResponse;
        if (!data || !data.base64Png) {
          throw new Error("Screenshot fetch failed or returned empty data.");
        }
        setShot(data);
      } catch (err) {
        setShot(undefined);
        console.error("Screenshot fetch error:", err);
      }

      // Update local tabs state to sync with backend changes
      setTabs(prevTabs => {
        return prevTabs.map(tab => {
          if (tab.id === currentTabId) {
            return {
              ...tab,
              steps: tab.steps.map(step => {
                // Find if this step was updated
                const update = updates?.find?.(u => u.id === step.id);
                if (update && step.type === 'TYPE') {
                  return {
                    ...step,
                    label: update.label,
                    text: update.text,
                    storeValue: update.storeValue
                  };
                }
                return step;
              })
            };
          }
          return tab;
        });
      });
    } catch (error) {
      console.error("Error updating steps:", error);
      console.error("Update details:", { sessionId, currentTabId });
      throw error;
    } finally {
      setLoading(false);
    }
  }

  return { sendStep, updateSteps };
}
