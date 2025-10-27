import { type Crop } from 'react-image-crop';

export interface ScreenshotResponse {
    base64Png: string;
    width: number;
    height: number;
    deviceScaleFactor: number;
  }
  
  export interface Coords {
    x: number;
    y: number;
  }
  
  export interface Viewport {
    width: number;
    height: number;
    deviceScaleFactor: number;
  }

  export type Selector = { strategy: "id" | "testId" | "text" | "css" | "xpath" | "role"; value: string };
  
  // Base interface for all step types
  interface BaseStep {
    viewport: Viewport;
    waitAfterMs?: number;
    timestamp: number;
  }
  
  // Discriminated union types for step variations
  export interface NavigateStep extends BaseStep {
    type: 'NAVIGATE';
    url: string;
    waitUntil?: 'networkidle' | 'domcontentloaded';
  }
  
  export interface ClickStep extends BaseStep {
    type: 'CLICK';
    coords: Coords;
    selector: Selector;
  }
  
  export interface TypeStep extends BaseStep {
    type: 'TYPE';
    coords: Coords;
    text: string;
    pressEnter?: boolean;
    label?: string;
    isPassword?: boolean;
    storeValue?: boolean;
    selector: Selector;
  }
  
  export interface ScrollStep extends BaseStep {
    type: 'SCROLL';
    coords: Coords;
    deltaY?: number;
  }
  
  export interface WaitStep extends BaseStep {
    type: 'WAIT';
    waitAfterMs: number;
  }
  
  // Discriminated union for all step types
  export type Step = NavigateStep | ClickStep | TypeStep | ScrollStep | WaitStep;
  
  export interface VariableRecord {
    label: string;
    text: string;
    isPassword?: boolean;
  }
  
  export interface RemoteRunnerProps {
    sessionId: string;
    metadata: Record<string, string>;
    insightId: string;
  }
  
  export interface CropArea {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }
  
  export interface ElementMetrics {
    offsetWidth: number;
    offsetHeight: number;
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
  }
  
  export type CSSMap = Record<string, string>;
  
  export interface ProbeRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  
  export interface Probe {
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
  }
  
  export interface ToolbarProps {
    sessionId: string;
    insightId: string;
    shot: ScreenshotResponse | undefined;
    setShot: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;
    mode: string;
    setMode: (mode : string) => void;
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    steps: Step[] | null;
    setSteps:  React.Dispatch<React.SetStateAction<Step[]>>;
    selectedModel: ModelOption | null;
  }

  export interface UseSendStepParams {
    sessionId: string;
    insightId: string;
    shot?: ScreenshotResponse;
    setShot?: React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;
    steps?: Step[] | null;
    setSteps?: React.Dispatch<React.SetStateAction<Step[]>>;
    setLoading?: React.Dispatch<React.SetStateAction<boolean>>;
  }

  export interface HeaderProps {
    insightId: string
    sessionId: string;
    shot: ScreenshotResponse | undefined;
    setShot:  React.Dispatch<React.SetStateAction<ScreenshotResponse | undefined>>;
    steps: Step[] 
    setSteps: React.Dispatch<React.SetStateAction<Step[]>>;
    loading: boolean
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    title: string;
    description: string;
    mode: string;
    setTitle: React.Dispatch<React.SetStateAction<string>>;
    setDescription: React.Dispatch<React.SetStateAction<string>>;
    selectedModel: ModelOption | null;
   setSelectedModel: React.Dispatch<React.SetStateAction<ModelOption | null>>
  }

  export interface VisionPopup {x: number; y: number; query: string; response: string | null;}

  export interface VisionPopupProps {
    sessionId: string;
    insightId: string
    visionPopup  :  VisionPopup | null;
    setVisionPopup: React.Dispatch<React.SetStateAction<VisionPopup | null>>;
    currentCropArea: CropArea | null;
    setCurrentCropArea: React.Dispatch<React.SetStateAction<CropArea | null>>;
    mode: string;
    setMode: React.Dispatch<React.SetStateAction<string>>
    crop: Crop | undefined;
    setCrop: React.Dispatch<React.SetStateAction<Crop| undefined>>;
    selectedModel: ModelOption | null;
  }

  export type ModelOption = { label: string; value: string };