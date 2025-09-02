package com.MCP.playwright.controllers;

import com.MCP.playwright.dtos.Step;

import java.util.List;

public record SaveAllRequest(
        String title,
        String description,
        List<Step> steps
) {}
