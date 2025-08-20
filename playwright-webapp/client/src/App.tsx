import './App.css'
import RemoteRunner from './components/RemoteRunner'
import { InsightProvider } from '@semoss/sdk-react';

function App() {

  return (
    <InsightProvider>
      <>
          <RemoteRunner></RemoteRunner>
      </>
   </InsightProvider>
  )
}

export default App
