import type { Probe, Selector } from "../types";

export function preferSelectorFromProbe(p?: Probe | null): Selector | undefined {
    if (!p) return;
    const a = (p as any).attrs || {};
    const testId = a["data-testid"] || a["data-test-id"];
    // Prefer stable selectors; de-prioritize ADF ids with "::"
    if (testId) return { strategy: "testId", value: testId };
    if (p.role) return { strategy: "role", value: p.role };
    if (a["id"] && !a["id"].includes("::")) return { strategy: "id", value: a["id"] };
    if (p.selector) return { strategy: "css", value: p.selector };
  }