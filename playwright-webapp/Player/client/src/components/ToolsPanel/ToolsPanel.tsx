import { Mouse as MouseIcon, ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon, 
  AccessTime as AccessTimeIcon, CropFree as CropIcon, 
  AutoAwesome as AutoAwesomeIcon } from "@mui/icons-material";
import './ToolsPanel.css';

interface ToolsPanelProps {
  onToolSelect: (tool: string) => void;
  selectedTool?: string;
}

function ToolsPanel(props: ToolsPanelProps) {
  const { onToolSelect, selectedTool } = props;

  const tools = [
    { id: "click", label: "Click to interact", icon: <MouseIcon /> },
    { id: "scroll-up", label: "Move view upward", icon: <ArrowUpIcon /> },
    { id: "scroll-down", label: "Move view downward", icon: <ArrowDownIcon /> },
    { id: "delay", label: "Add a short delay", icon: <AccessTimeIcon /> },
    { id: "crop", label: "Capture screen context", icon: <CropIcon /> },
    { id: "generate-steps", label: "Get AI recommendations", icon: <AutoAwesomeIcon /> },
  ];

  return (
    <div className="tools-panel">
      <div className="tools-panel-content">
        <a className="tools-header-tag">TOOLS</a>
        <div className="tools-list">
          {tools.map((tool) => {
            const isSelected = selectedTool === tool.id;
            return (
              <div
                key={tool.id}
                className={`tool-item ${isSelected ? 'tool-item-selected' : ''}`}
                onClick={() => onToolSelect(tool.id)}
              >
                <div className="tool-item-icon-wrapper">
                  {tool.icon}
                </div>
                <span className="tool-item-label">{tool.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ToolsPanel;

