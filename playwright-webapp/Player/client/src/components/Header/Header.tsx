import { Autocomplete, TextField } from "@mui/material"
import { useEffect, useState } from "react";
import type { HeaderProps, ReplayPixelOutput } from "../../types";
import { runPixel } from "@semoss/sdk";
import './Header.css';
import {Insight}  from 'https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.29/+esm';

function Header(props : HeaderProps) {
    const {insightId, sessionId, steps, selectedRecording, setSelectedRecording
            , setLoading, setEditedData, setUpdatedData, setShowData, setIsLastPage, setShot, setOverlay, setLive} = props
    const [allRecordings, setAllRecordings] = useState<string[]>([]);


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
    
          const maybeSymbol = tool?.parameters?.recordedFile;
          
          setSelectedRecording(maybeSymbol);
          
        };
        fetchRecordings();
    }, []);

    
  async function editRecording() {

    if (!selectedRecording) {
      alert("Please select a recording first.");
      return;
    }

    const name = selectedRecording;

    // Pause live mode during loading to prevent interference
    setLive(false);
    setLoading(true);

    const pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${name}", executeAll=false);`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

    setLoading(false);
    setEditedData(output.actions);
    setUpdatedData(output.actions);
    setShowData(true);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);

    // Clear any existing overlay to allow auto-detection to work
    setOverlay(null);

    // Re-enable live mode after loading completes
    console.log('[Load Recording] Enabling live mode');
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

        <span className="header-recording-count">Steps: {steps.length}</span>
      </div>
    </>
  )
}

export default Header;