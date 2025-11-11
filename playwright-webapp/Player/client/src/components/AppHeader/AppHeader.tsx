// import { type JSX } from "react";
import './AppHeader.css';

function AppHeader() {
  const appType: "player" | "recorder" = "player"; // This is the Player app

  return (
    <div className="app-header">
      <div className={`app-label ${appType === "player" ? "app-label-active" : ""}`}>
        Player
      </div>
      {/* <div className={`app-label ${appType === "recorder" ? "app-label-active" : ""}`}> */}
      <div className={`app-label-active`}>
        Recorder
      </div>
    </div>
  );
}

export default AppHeader;

