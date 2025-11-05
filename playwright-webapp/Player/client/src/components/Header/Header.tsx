import { Autocomplete, Box, TextField, Typography } from "@mui/material"
import { useEffect, useMemo ,useState } from "react";
import type { HeaderProps, ModelOption, ReplayPixelOutput } from "../../types";
import {runPixel } from "@semoss/sdk";
import { checkSessionExpired } from "../../utils/errorHandler";
import {Insight}  from 'https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.29/+esm';

import './Header.css';


function Header(props : HeaderProps) {
    const {insightId, sessionId, selectedRecording, setSelectedRecording
            , setLoading, setEditedData, setUpdatedData, setShowData,
            setIsLastPage, setShot, live, setLive, currUserModels, setCurrUserModels,
            selectedModel, setSelectedModel} = props

    const [allRecordings, setAllRecordings] = useState<string[]>([]);
    const modelOptions: ModelOption[] = useMemo(() => 
      Object.entries(currUserModels).map(([name, id]) => ({
        label: name,
        value: id,
      })), 
      [currUserModels]
    );

    useEffect(() => {
      async function getUserModels() {
        try {
          const pixel = `MyEngineProject(metaKeys = [], metaFilters=[{}], filterWord=[""], type=[["MODEL"]]);`;
          const res = await runPixel(pixel, insightId);
          const output = res.pixelReturn[0].output;
  
          if (Array.isArray(output)) {
            const userModelsMap = output.reduce((acc, item) => {
              acc[item.database_name] = item.database_id;
              return acc;
            }, {});
  
            setCurrUserModels((prev) => ({
              ...prev,
              ...userModelsMap,
            }));
          }
        } catch (err) {
          console.error("Fetch User Model err:", err);
        }
      }
      getUserModels();
    }, [insightId]);

    useEffect(() => {
      if (modelOptions.length > 0) {
        setSelectedModel(modelOptions[0]);
      } else {
        setSelectedModel(null);
      }
    }, [modelOptions]);
    
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

    setLoading(true);
    
    try {
    let pixel = `ReplayStep (sessionId = "${sessionId}", fileName = "${name}", executeAll=false);`;
    const res = await runPixel(pixel, insightId);
    
    if (checkSessionExpired(res.pixelReturn)) {
      return;
    }
    
    const { output } = res.pixelReturn[0] as { output: ReplayPixelOutput };

    setLoading(false);
      
    // Initialize with first tab
    if (props.setTabs) {
      props.setTabs([{ id: output.originalTabId?? "tab-1", title: output.tabTitle?? "Tab 1", actions: output.actions || [] }]);
    }
    if (props.setActiveTabId) {
      props.setActiveTabId(output.originalTabId?? "tab-1");
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

        <Autocomplete
          options={modelOptions}
          value={selectedModel}
          onChange={(_, newValue) => setSelectedModel(newValue)}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <div>
                <Typography variant="body1">{option.label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                  {option.value}
                </Typography>
              </div>
            </Box>
          )}
          renderInput={(params) => (
            <TextField {...params} label="Select LLM" placeholder="Search models..." />
          )}
          sx={{ minWidth: 250 }}
        />
      </div>
    </>
  )
}

export default Header;