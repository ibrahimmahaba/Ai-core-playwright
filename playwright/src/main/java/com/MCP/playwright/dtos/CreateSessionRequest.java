package com.MCP.playwright.dtos;

public record CreateSessionRequest(String url, Integer width, Integer height, Double deviceScaleFactor) {}
