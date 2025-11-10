import { Autocomplete, Box, TextField, Typography } from "@mui/material"
import { useEffect, useMemo ,useState } from "react";
import type { HeaderProps, ModelOption, ReplayPixelOutput } from "../../types";
import {runPixel } from "@semoss/sdk";
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

        {/* Load from local JSON */}
        <input
          id="load-json-input"
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const parsed = JSON.parse(text);

              // Normalize into Action[]
              const normalizeToActions = (raw: any): any[] => {
                if (Array.isArray(raw)) {
                  // Detect Action[] form (keys like TYPE/CLICK/WAIT/NAVIGATE/SCROLL)
                  const looksLikeAction =
                    raw.length === 0 ||
                    typeof raw[0] === "object" &&
                    raw[0] !== null &&
                    (("TYPE" in raw[0]) || ("CLICK" in raw[0]) || ("WAIT" in raw[0]) || ("NAVIGATE" in raw[0]) || ("SCROLL" in raw[0]));
                  if (looksLikeAction) return raw;

                  // Detect Step[] form (has 'type')
                  const looksLikeStep =
                    raw.length === 0 ||
                    (raw[0] && typeof raw[0] === "object" && "type" in raw[0]);
                  if (looksLikeStep) {
                    return raw.map((s: any) => {
                      switch (s.type) {
                        case "TYPE":
                          return { TYPE: { label: s.label ?? "", text: s.text ?? "", isPassword: !!s.isPassword, coords: s.coords } };
                        case "CLICK":
                          return { CLICK: { coords: s.coords } };
                        case "WAIT":
                          return { WAIT: s.waitAfterMs || s.wait || 0 };
                        case "NAVIGATE":
                          return { NAVIGATE: s.url || "" };
                        case "SCROLL":
                          return { SCROLL: { deltaY: s.deltaY ?? 0 } };
                        default:
                          return null;
                      }
                    }).filter(Boolean);
                  }
                }
                // Fallback
                return [];
              };

              const actions = normalizeToActions(parsed);
              if (!Array.isArray(actions)) throw new Error("Invalid JSON format for steps/actions");

              // Load into a single tab and primaries
              if (props.setTabs) {
                props.setTabs([{ id: "tab-1", title: file.name.replace(/\.json$/i, "") || "Tab 1", actions }]);
              }
              if (props.setActiveTabId) {
                props.setActiveTabId("tab-1");
              }
              setEditedData(actions);
              setUpdatedData(actions);
              setShowData(true);
              // Clear any server-selected recording since we are using a local file
              setSelectedRecording(null);

              // Ask toolbar to open Steps panel
              try { window.dispatchEvent(new CustomEvent('openShowStepsPanel')); } catch {}
            } catch (err) {
              console.error("Failed to load JSON:", err);
              alert("Failed to load JSON: " + err);
            } finally {
              // reset input to allow re-selecting the same file
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
        <button onClick={() => document.getElementById("load-json-input")?.click()}>
          Load from JSON
        </button>

        <button onClick={startLiveReplay}>
          Start Live Replay
        </button>
        <button onClick={() => setLive(false)} disabled={!live}>Stop Live</button>
      </div>
    </>
  )
}

export default Header;