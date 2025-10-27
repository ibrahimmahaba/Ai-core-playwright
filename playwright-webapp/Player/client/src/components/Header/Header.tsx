import { Autocomplete, TextField } from "@mui/material"
import { useEffect, useState } from "react";
import type { HeaderProps, ReplayPixelOutput } from "../../types";
import {Insight, runPixel } from "@semoss/sdk";
import './Header.css';

function Header(props : HeaderProps) {
    const {insightId, sessionId, steps, selectedRecording, setSelectedRecording
            , setLoading, setEditedData, setUpdatedData, setShowData, setIsLastPage, setShot, live, setLive} = props
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
    
          const maybeSymbol = tool?.parameters?.sessionId;
    
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

    setLoading(true);
    
    try {
    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${name}", executeAll=false);`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

    setLoading(false);
      
    // Initialize with first tab
    if (props.setTabs) {
      props.setTabs([{ id: "tab-1", title: output.tabTitle?? "Tab 1", actions: output.actions || [] }]);
    }
    if (props.setActiveTabId) {
      props.setActiveTabId("tab-1");
    }
      
    setEditedData(output.actions);
    setUpdatedData(output.actions);
    setShowData(true);
    setIsLastPage(output.isLastPage);
    setShot(output.screenshot);
    } catch (err) {
      console.error("Error loading recording:", err);
      alert("Error loading recording: " + err);
    } finally {
      setLoading(false);
    }
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