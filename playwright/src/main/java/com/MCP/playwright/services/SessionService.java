package com.MCP.playwright.services;

import com.MCP.playwright.dtos.*;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.WaitUntilState;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionService {
    private final Playwright pw = Playwright.create();
    private final Browser browser = pw.chromium().launch(
            new BrowserType.LaunchOptions().setHeadless(true)
    );

    static class Session {
        final BrowserContext ctx;
        final Page page;
        StepsEnvelope history = new StepsEnvelope("1.0", new java.util.ArrayList<>());

        Session(BrowserContext ctx, Page page) {
            this.ctx = ctx; this.page = page;
        }
    }

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public record CreateResult(String sessionId, ScreenshotResponse firstShot) {}

    public CreateResult createAndOpen(CreateSessionRequest req) {
        int width  = req.width()  != null ? req.width()  : 1280;
        int height = req.height() != null ? req.height() : 800;
        double dpr = req.deviceScaleFactor() != null ? req.deviceScaleFactor() : 1.0;

        Browser.NewContextOptions ctxOps = new Browser.NewContextOptions()
                .setViewportSize(width, height)
                .setDeviceScaleFactor(dpr);

        BrowserContext ctx = browser.newContext(ctxOps);
        Page page = ctx.newPage();

        if (req.url() != null && !req.url().isBlank()) {
            page.navigate(req.url(), new Page.NavigateOptions().setWaitUntil(WaitUntilState.NETWORKIDLE));
        }

        Session s = new Session(ctx, page);
        String id = UUID.randomUUID().toString();
        sessions.put(id, s);

        // record NAVIGATE step if provided
        if (req.url() != null && !req.url().isBlank()) {
            s.history.steps().add(new Step(
                    StepType.NAVIGATE, req.url(), null, null, null, null, "networkidle", 0,
                    new Viewport(width, height, dpr), System.currentTimeMillis()
            ));
        }

        return new CreateResult(id, screenshot(id));
    }

    public ScreenshotResponse screenshot(String sessionId) {
        Session s = get(sessionId);
        byte[] buf = s.page.screenshot(new Page.ScreenshotOptions().setFullPage(false));
        String b64 = java.util.Base64.getEncoder().encodeToString(buf);

        int vpW = s.page.viewportSize().width;
        int vpH = s.page.viewportSize().height;

        // devicePixelRatio can come back as Integer or Double — always treat as Number
        Object raw = s.page.evaluate("() => Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1");
        double dpr = (raw instanceof Number) ? ((Number) raw).doubleValue() : 1.0;

        return new ScreenshotResponse(b64, vpW, vpH, dpr);
    }

    public ScreenshotResponse executeStep(String sessionId, Step step) {
        Session s = get(sessionId);
        applyStep(s, step);
        s.history.steps().add(step);
        return screenshot(sessionId);
    }

    public ScreenshotResponse replay(String sessionId, StepsEnvelope steps) {
        // Reset context to a fresh page so replay is deterministic
        Session sOld = get(sessionId);
        sOld.ctx.close();

        BrowserContext ctx = browser.newContext(new Browser.NewContextOptions()
                .setViewportSize(steps.steps().get(0).viewport().width(),
                        steps.steps().get(0).viewport().height())
                .setDeviceScaleFactor(steps.steps().get(0).viewport().deviceScaleFactor())
        );
        Page page = ctx.newPage();
        Session s = new Session(ctx, page);
        sessions.put(sessionId, s);

        for (Step st : steps.steps()) applyStep(s, st);
        s.history = steps;
        return screenshot(sessionId);
    }

    public StepsEnvelope history(String sessionId) {
        return get(sessionId).history;
    }

    private Session get(String id) {
        Session s = sessions.get(id);
        if (s == null) throw new RuntimeException("Unknown session: " + id);
        return s;
    }

    private void applyStep(Session s, Step step) {
        Page page = s.page;

        try {
            switch (step.type()) {
                case NAVIGATE -> {
                    Page.NavigateOptions opts = new Page.NavigateOptions();
                    if ("networkidle".equalsIgnoreCase(step.waitUntil())) {
                        opts.setWaitUntil(WaitUntilState.NETWORKIDLE);
                    } else if ("domcontentloaded".equalsIgnoreCase(step.waitUntil())) {
                        opts.setWaitUntil(WaitUntilState.DOMCONTENTLOADED);
                    } else if ("load".equalsIgnoreCase(step.waitUntil())) {
                        opts.setWaitUntil(WaitUntilState.LOAD);
                    }
                    page.navigate(step.url(), opts);
                }
                case CLICK -> {
                    // Coordinates are in CSS pixels relative to the page viewport.
                    page.mouse().move(step.coords().x(), step.coords().y());
                    page.mouse().click(step.coords().x(), step.coords().y());
                }
                case TYPE -> {
                    page.mouse().click(step.coords().x(), step.coords().y());
                    if (step.text() != null) page.keyboard().type(step.text());
                    if (Boolean.TRUE.equals(step.pressEnter())) page.keyboard().press("Enter");
                }
                case SCROLL -> {
                    int dy = step.deltaY() != null ? step.deltaY() : 300;
                    page.mouse().wheel(0, dy);
                }
                case WAIT -> {
                    int ms = step.waitAfterMs() != null ? step.waitAfterMs() : 300;
                    page.waitForTimeout(ms);
                }
            }
            if (step.waitAfterMs() != null && step.waitAfterMs() > 0) {
                page.waitForTimeout(step.waitAfterMs());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to apply step: " + step.type(), e);
        }
    }
}
