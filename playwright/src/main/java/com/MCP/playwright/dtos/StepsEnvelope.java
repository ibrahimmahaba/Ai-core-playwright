package com.MCP.playwright.dtos;

import java.util.List;

public record StepsEnvelope(
        String version,
        RecordingMeta meta,        // <-- NEW (nullable)
        List<Step> steps
) {}