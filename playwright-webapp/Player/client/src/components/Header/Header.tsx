import { Autocomplete, TextField } from "@mui/material"
import { useEffect, useState } from "react";
import type { Action, HeaderProps, ReplayPixelOutput } from "../../types";
import {Insight, runPixel } from "@semoss/sdk";
import './Header.css';

function Header(props : HeaderProps) {
    const {insightId, sessionId, steps, selectedRecording, setSelectedRecording
            , setLoading, setEditedData, setUpdatedData, setShowData, setIsLastPage, setShot, live, setLive, initialParamValues} = props
    const [allRecordings, setAllRecordings] = useState<string[]>([]);
    const [hasAutoLoaded, setHasAutoLoaded] = useState(false);


    useEffect(() => {
        const fetchRecordings = async () => {
          let pixel = `ListPlaywrightScripts();`
          console.log(insightId);
          const res = await runPixel(pixel, insightId);
          const { output } = res.pixelReturn[0];
    
          if (Array.isArray(output))
          {      
            setAllRecordings(output as string[]);
          } else {
            console.error("Invalid response structure for recordings:", output);
            setAllRecordings([]);
          }
    
                
          const insight = new Insight();
    
          const initRes: any = await insight.initialize();
    
          const tool = await initRes?.tool;
    
          // Check for recordedFile parameter (the file to replay)
          const recordedFile = tool?.parameters?.recordedFile || tool?.parameters?.sessionId;
    
          if (recordedFile) {
            setSelectedRecording(recordedFile);
          }
          
        };
        fetchRecordings();
    }, []);

    // Auto-load recording when selectedRecording is set and we have initial param values
    useEffect(() => {
      if (!hasAutoLoaded && selectedRecording && initialParamValues && Object.keys(initialParamValues).length > 0) {
        console.log("Auto-loading recording with MCP parameters:", selectedRecording, initialParamValues);
        setHasAutoLoaded(true);
        editRecording();
      }
    }, [selectedRecording, initialParamValues, hasAutoLoaded]);

    
  // Normalize MCP parameter keys to match recording labels
  // Handles: "monday" -> "Monday", "attendance_hours_entry_for_tuesday" -> "Attendance Hours entry for Tuesday"
  function normalizeParamValues(actions: Action[], mcpParams: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    
    // Extract all TYPE action labels from the recording
    const recordingLabels = actions
      .filter(action => "TYPE" in action)
      .map(action => action.TYPE.label);
    
    // For each MCP parameter, try to match it to a recording label
    Object.entries(mcpParams).forEach(([mcpKey, value]) => {
      // Try exact match first
      if (recordingLabels.includes(mcpKey)) {
        normalized[mcpKey] = value;
        return;
      }
      
      // Try case-insensitive match
      const caseInsensitiveMatch = recordingLabels.find(
        label => label.toLowerCase() === mcpKey.toLowerCase()
      );
      if (caseInsensitiveMatch) {
        normalized[caseInsensitiveMatch] = value;
        return;
      }
      
      // Try converting snake_case to proper label format
      // "attendance_hours_entry_for_tuesday" -> "Attendance Hours entry for Tuesday"
      const snakeCaseMatch = recordingLabels.find(label => {
        // Remove all spaces and convert to lowercase for comparison
        const labelNormalized = label.toLowerCase().replace(/\s+/g, '_');
        return labelNormalized === mcpKey.toLowerCase();
      });
      if (snakeCaseMatch) {
        normalized[snakeCaseMatch] = value;
        return;
      }
      
      // If no match found, keep the original key (backend will handle or ignore)
      console.warn(`Could not match MCP parameter "${mcpKey}" to any recording label`);
      normalized[mcpKey] = value;
    });
    
    console.log("Normalized param values:", normalized);
    return normalized;
  }

  async function editRecording() {

    if (!selectedRecording) {
      alert("Please select a recording first.");
      return;
    }

    const name = selectedRecording;

    setLoading(true);
    
    // First, load the recording to get the actions and their labels
    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${name}", executeAll=false);`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

    // If we have initial param values from MCP, normalize them and update the actions
    if (initialParamValues && Object.keys(initialParamValues).length > 0) {
      console.log("Applying initial param values:", initialParamValues);
      const normalizedParams = normalizeParamValues(output.actions, initialParamValues);
      
      // Update the TYPE actions with the normalized values
      const updatedActions = output.actions.map(action => {
        if ("TYPE" in action && normalizedParams[action.TYPE.label]) {
          return {
            ...action,
            TYPE: {
              ...action.TYPE,
              text: normalizedParams[action.TYPE.label]
            }
          };
        }
        return action;
      });
      
      setEditedData(updatedActions);
      setUpdatedData(updatedActions);
    } else {
      setEditedData(output.actions);
      setUpdatedData(output.actions);
    }

    setLoading(false);
    setShowData(true);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
  }

  async function startLiveReplay() {
    setLive(true);
  }

  return (
    <>
        <h2 className="header-title">Playwright Script Player App</h2>
      <div className="header-controls">

        <Autocomplete
          options={Array.isArray(allRecordings) ? allRecordings : []}
          value={selectedRecording}
          onChange={(_, newValue) => setSelectedRecording(newValue)}
          renderInput={(params) => (
            <TextField {...params} label="Select Recording" placeholder="Search recordings..." />
          )}
          sx={{ minWidth: 250 }}
        />

        <button onClick={editRecording}>
          Load Recording (Edit)
        </button>

        <button onClick={startLiveReplay}>
          Start Live Replay
        </button>
        <button onClick={() => setLive(false)} disabled={!live}>Stop Live</button>
        <span className="header-recording-count">Steps: {steps.length}</span>
      </div>
    </>
  )
}

export default Header