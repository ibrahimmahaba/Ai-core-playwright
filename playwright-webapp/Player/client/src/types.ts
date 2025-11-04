import type { Insight } from 'https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.29/+esm';
import { type Crop } from 'react-image-crop';

export type CropArea = {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  
  export type ElementMetrics = {
    offsetWidth: number;
    offsetHeight: number;
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
  };
  
  export type CSSMap = Record<string, string>;
  
  export type ProbeRect = { x: number; y: number; width: number; height: number };
  
  export type Probe = {
    tag: string | null;
    type: string | null;
    inputCategory: string | null;
    role: string | null;
    selector: string | null;
    placeholder: string | null;
    labelText: string | null;
    value: string | null;
    href: string | null;
    contentEditable: boolean;
    rect: ProbeRect;
    metrics?: ElementMetrics | null;
    styles?: CSSMap | null;
    placeholderStyle?: CSSMap | null;
    attrs?: Record<string, string> | null;
    isTextControl?: boolean;
  };
  
  export type ScreenshotResponse = {
    base64Png: string;
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  
  export type Coords = { x: number; y: number };
  
  export type Viewport = { width: number; height: number; deviceScaleFactor: number };

  export type Selector = { strategy: "id" | "testId" | "text" | "css" | "xpath" | "role"; value: string };

  export type Step =
  | { type: "NAVIGATE"; url: string; waitUntil?: "networkidle" | "domcontentloaded"; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "CLICK"; coords: Coords; viewport: Viewport; waitAfterMs?: number; timestamp: number, selector: Selector }
  | {
    type: "TYPE";
    coords: Coords;
    text: string;
    pressEnter?: boolean;
    viewport: Viewport;
    waitAfterMs?: number;
    timestamp: number;
    label?: string;
    isPassword?: boolean;
    storeValue?: boolean;
    selector: Selector;
  }
  | { type: "SCROLL"; coords: Coords; deltaY?: number; viewport: Viewport; waitAfterMs?: number; timestamp: number }
  | { type: "WAIT"; waitAfterMs: number; viewport: Viewport; timestamp: number };

  export type Action =
    | { TYPE: { label: string; text: string; isPassword?: boolean; coords?: Coords; probe?: Probe } }
    | { CLICK: { coords: Coords } }
    | { SCROLL: { deltaY: number } }
    | { WAIT: number } // waitAfterMilliseconds
    | { NAVIGATE: string }; // url
  
  export type RemoteRunnerProps = {
    sessionId: string;
    insightId: string;
    insight: Insight;
  };
  
  export type ReplayPixelOutput = {
    isLastPage: boolean;
    actions: Action[];
    screenshot?: ScreenshotResponse;
    isNewTab?: boolean;      
    newTabId?: string; 
    tabTitle?: string; 
    originalTabId?: string;
    originalTabActions?: Action[];
  };
  
  export type modelGeneratedSteps = {
    success: boolean;
    rawResponse: string;
    stepsJson: string;
    error?: string;
  };

  export interface UseSendStepParams {
    sessionId: string;
    insightId: string;
    shot?: ScreenshotResponse;
    setShot?: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;
    steps?: Step[] | null;
    setSteps?: React.Dispatch<React.SetStateAction<Step[]>>;
    setLoading?: React.Dispatch<React.SetStateAction<boolean>>;
    tabs?: TabData[];
    setTabs?: React.Dispatch<React.SetStateAction<TabData[]>>;
    _activeTabId?: string;
    setActiveTabId?: React.Dispatch<React.SetStateAction<string>>;
  }

  export interface ToolbarProps {
    sessionId: string;
    insightId: string;
    shot: ScreenshotResponse | undefined;
    setShot: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;
    mode: string;
    setMode: React.Dispatch<React.SetStateAction<string>>;
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    steps: Step[] | null;
    setSteps: React.Dispatch<React.SetStateAction<Step[]>>;
    generationUserPrompt: string;
    setGenerationUserPrompt: React.Dispatch<React.SetStateAction<string>>;
    selectedModel: ModelOption | null;
    tabId: string;
    editedData?: Action[];
    setEditedData?: React.Dispatch<React.SetStateAction<Action[]>>;
  }


  export interface HeaderProps {
   insightId: string;
   sessionId: string
   steps: Step[] 
   selectedRecording: string | null;
   setSelectedRecording: React.Dispatch<React.SetStateAction<string | null>>;
   setLoading: React.Dispatch<React.SetStateAction<boolean>>;
   setEditedData: React.Dispatch<React.SetStateAction<Action[]>>;
   setUpdatedData: React.Dispatch<React.SetStateAction<Action[]>>;
   setShowData: React.Dispatch<React.SetStateAction<boolean>>;
   setShot: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;
   setIsLastPage: React.Dispatch<React.SetStateAction<boolean>>;
   live: boolean;
   setLive: React.Dispatch<React.SetStateAction<boolean>>;
   currUserModels: Record<string, string>;
   setCurrUserModels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
   selectedModel: ModelOption | null;
   setSelectedModel: React.Dispatch<React.SetStateAction<ModelOption | null>>
   tabs?: TabData[];
   setTabs?: React.Dispatch<React.SetStateAction<TabData[]>>;
   activeTabId?: string;
   setActiveTabId?: React.Dispatch<React.SetStateAction<string>>;
  }

  export interface Overlay{
    kind: "input" | "confirm";
    probe: Probe;
    draftValue?: string;
    draftLabel?: string | null;
  }

  export interface StepsBottomSectionProps{
    insightId: string;
    sessionId: string;
    showData: boolean;
    setShowData: React.Dispatch<React.SetStateAction<boolean>>;
    lastPage: boolean;
    setIsLastPage: React.Dispatch<React.SetStateAction<boolean>>;
    editedData: Action[];
    overlay: Overlay | null
    setOverlay: React.Dispatch<React.SetStateAction<Overlay | null>>;
    selectedRecording: string | null;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setEditedData: React.Dispatch<React.SetStateAction<Action[]>>;
    updatedData: Action[];
    setUpdatedData: React.Dispatch<React.SetStateAction<Action[]>>;
    setShot: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;
    setHighlight: React.Dispatch<React.SetStateAction<Coords | null>>;
    steps: Step[] ;
    setSteps: React.Dispatch<React.SetStateAction<Step[]>>;
    shot: ScreenshotResponse | undefined;
    activeTabId: string;  
    tabs?: TabData[];     
    setTabs?: React.Dispatch<React.SetStateAction<TabData[]>>; 
    setActiveTabId?: React.Dispatch<React.SetStateAction<string>>;
  }

  export interface VisionPopup {x: number; y: number; query: string; response: string | null;}

  export interface VisionPopupProps {
    sessionId: string;
    insightId: string;
    insight: Insight;
    visionPopup  :  VisionPopup | null;
    setVisionPopup: React.Dispatch<React.SetStateAction<VisionPopup | null>>;
    currentCropArea: CropArea | null;
    setCurrentCropArea: React.Dispatch<React.SetStateAction<CropArea | null>>;
    mode: string;
    setMode: React.Dispatch<React.SetStateAction<string>>;
    crop: Crop | undefined;
    setCrop: React.Dispatch<React.SetStateAction<Crop| undefined>>
    selectedModel: ModelOption | null;
    tabId: string;
  }


  export interface ModelResultsProps{
    showModelResults: boolean;
    setShowModelResults:React.Dispatch<React.SetStateAction<boolean>>;
    modelGeneratedSteps: modelGeneratedSteps | null;
  }

  export type ExtractedElement = {
    tag: string;
    id: string | null;
    className: string | null;
    text: string;
    html: string;
    rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    selector: string;
    attributes: {
      id?: string;
      name?: string;
      class?: string;
      placeholder?: string;
      type?: string;
      value?: string;
      href?: string;
      src?: string;
      alt?: string;
      title?: string;
      role?: string;
      "aria-label"?: string;
      "data-testid"?: string;
    };
    interactive: boolean;
    visible: boolean;
  };
  
  export type ExtractionData = {
    html: string;
    elements: ExtractedElement[];
    elementCount: number;
    interactiveCount: number;
    bounds: {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      width: number;
      height: number;
    };
    summary: {
      totalElements: number;
      interactiveElements: number;
      tags: string[];
      hasForm: boolean;
    };
  };

  export type ModelOption = { label: string; value: string };
  export interface TabData {
    id: string;
    title: string;
    actions: Action[];
  }
