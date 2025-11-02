import './App.css'
import RemoteRunner from './components/RemoteRunner'
import { Env } from '@semoss/sdk/react';
import { runPixel } from "@semoss/sdk";
// import { useInsight } from "@semoss/sdk-react";
import { Insight } from 'https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.29/+esm';
import { useEffect, useState } from 'react';
import { Alert, CircularProgress } from '@mui/material';

function App() {

  const [insight] = useState(() => new Insight());
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [insightId, setInsightId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  Env.update({
    MODULE: process.env.MODULE || '',
    ACCESS_KEY: process.env.ACCESS_KEY || '',
    SECRET_KEY: process.env.SECRET_KEY || ''
  });
  
  useEffect( () => { const init = async() => {
    try{
      if(!isInitialized) {
        // wait until initialized
        console.log("Waiting for initialization...");
        console.log("Initializing insight...");
        await insight.initialize();
        setInsightId(insight._store.insightId);
        setIsInitialized(true);
        return;
   
      }
   
    let pixel = `Session ( )`;
    const res = await runPixel(pixel, insightId);
    const { output } = res.pixelReturn[0];
    console.log("Session ID:", output);

    setSessionId(output as string);
    } catch(e: any){
      console.error("Error initializing session:", e);
      setError(e.message || "Unknown error");
    }
  };
    init();
}, [isInitialized, insightId, insight] );

  if(error) {
    return (
      <div>
        <Alert severity="error">{error}</Alert>
      </div>
    )
  }

  if(!sessionId) return (
    <div>
      <CircularProgress />
      <p>Loading session...</p>
  </div>
  );

  return (
      <>
          <RemoteRunner sessionId={sessionId} insight={insight} insightId={insightId} ></RemoteRunner>
      </>
  )
}

export default App