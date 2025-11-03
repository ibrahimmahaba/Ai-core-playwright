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
    id?: number;  // Optional during creation, assigned by sendStep
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
  


  export interface TabData {
    id: string;  
    title: string;
    steps: Step[];
  }

  export interface VisionPopup {x: number; y: number; query: string; response: string | null;}

  export interface VisionPopupProps {
    visionPopup: VisionPopup | null;
    setVisionPopup: React.Dispatch<React.SetStateAction<VisionPopup | null>>;
    currentCropArea: CropArea | null;
    setCurrentCropArea: React.Dispatch<React.SetStateAction<CropArea | null>>;
    setCrop: React.Dispatch<React.SetStateAction<Crop | undefined>>;
  }
  


  export type ModelOption = { label: string; value: string } ;