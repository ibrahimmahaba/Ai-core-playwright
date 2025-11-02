//semoss-sdk.d.ts
 
declare module "https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.29/+esm" {

    export interface InsightStore {
        insightId: string;
        [key: string]: any;
    }

    export class Insight {
        constructor();
        isReady: boolean;
        error: string | null;
        isAuthorized: boolean;
        _store: InsightStore;
        actions: {
            runMCPTool(toolName: string, params: Record<string, any>): Promise<{ output: any }>;
        };
        initialize(): Promise<{ tool?: { name: string; parameters?: { sessionId?: string; symbol?: string } } }>;
    }
   
    export class Env {
        // Add any required Env class properties or methods here if needed
    }
}