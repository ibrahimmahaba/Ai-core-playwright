package com.MCP.playwright.dtos;

public record ScreenshotResponse(String base64Png, int width, int height, double deviceScaleFactor) {}
