package com.MCP.playwright.dtos;

public record SelectionResult(
        String label,        // optional label you pass via Step.text for SELECT_TEXT
        String text,         // full text from the element
        String word,         // word under the click (best effort)
        String selector,     // simple CSS-ish path
        String tag,          // tag name (e.g., 'a', 'input')
        String href,         // nearest link's href if any
        Long timestamp
) {}