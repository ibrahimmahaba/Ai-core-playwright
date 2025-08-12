package com.MCP.playwright.dtos;

import java.util.List;

public record StepsEnvelope(String version, List<Step> steps) {}
