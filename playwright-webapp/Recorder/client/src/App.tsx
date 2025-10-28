import './App.css'
import RemoteRunner from './components/RemoteRunner'
import { Env } from '@semoss/sdk/react';
import { useInsight } from "@semoss/sdk-react";
import { useEffect, useState } from 'react';
import { Alert, CircularProgress } from '@mui/material';
import { useSessionStore } from './store/useSessionStore';

function App() {
  const { insightId, isInitialized } = useInsight();
  const {
    sessionId,
    initSession,
  } = useSessionStore();

  const [error, setError] = useState<string | null>(null);

  Env.update({
    MODULE: process.env.MODULE || '',
    ACCESS_KEY: process.env.ACCESS_KEY || '',
    SECRET_KEY: process.env.SECRET_KEY || ''
  });

  useEffect(() => {
    const startSession = async () => {
      try {
        await initSession(insightId, isInitialized);
      } catch (e: any) {
        console.error("Error initializing session:", e);
        setError(e.message || "Unknown error");
      }
    };
    startSession();
  }, [isInitialized, insightId, initSession]);

  if (error) {
    return (
      <div>
        <Alert severity="error">{error}</Alert>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div>
        <CircularProgress />
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <>
      <RemoteRunner />
    </>
  );
}

export default App;
