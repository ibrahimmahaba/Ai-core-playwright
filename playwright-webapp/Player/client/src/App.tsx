import './App.css'
import RemoteRunner from './components/RemoteRunner'
import { Env } from '@semoss/sdk/react';
import { InsightProvider } from '@semoss/sdk-react';

function App() {
  
  Env.update({
    MODULE: process.env.MODULE || '',
    ACCESS_KEY: process.env.ACCESS_KEY || '',
    SECRET_KEY: process.env.SECRET_KEY || ''
  });

  return (
    <InsightProvider>
      <>
          <RemoteRunner></RemoteRunner>
      </>
   </InsightProvider>
  )
}

export default App