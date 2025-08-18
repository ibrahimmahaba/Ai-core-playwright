package com.MCP.playwright.services;

import com.MCP.playwright.dtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.WaitUntilState;
import org.springframework.stereotype.Service;

import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SessionService {
    private final Playwright pw = Playwright.create();
    private final Browser browser = pw.chromium().launch(
            new BrowserType.LaunchOptions().setHeadless(true)
    );
    private final ObjectMapper json = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final Path recordingsDir = initRecordingsDir();

    static class Session {
        final BrowserContext ctx;
        final Page page;
        StepsEnvelope history = new StepsEnvelope("1.0", new java.util.ArrayList<>());
        final java.util.List<SelectionResult> selections = new java.util.ArrayList<>();

        // --- segmented replay state (NEW) ---
        StepsEnvelope runningScript = null;
        int cursor = 0;
        boolean paused = false;
        String pauseLabel = null;

        Session(BrowserContext ctx, Page page) {
            this.ctx = ctx; this.page = page;
        }
    }

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public record CreateResult(String sessionId, ScreenshotResponse firstShot) {}
    public record ReplayFrame(ScreenshotResponse shot, boolean paused, String pauseLabel, int cursor, boolean done) {}

    public CreateResult createAndOpen(CreateSessionRequest req) {
        int width  = req.width()  != null ? req.width()  : 1280;
        int height = req.height() != null ? req.height() : 800;
        double dpr = req.deviceScaleFactor() != null ? req.deviceScaleFactor() : 1.0;

        Browser.NewContextOptions ctxOps = new Browser.NewContextOptions()
                .setViewportSize(width, height)
                .setDeviceScaleFactor(dpr);

        BrowserContext ctx = browser.newContext(ctxOps);
        ctx.setDefaultTimeout(60_000);
        ctx.setDefaultNavigationTimeout(60_000);
        Page page = ctx.newPage();

        if (req.url() != null && !req.url().isBlank()) {
            page.navigate(req.url(), new Page.NavigateOptions().setWaitUntil(WaitUntilState.NETWORKIDLE));
        }

        Session s = new Session(ctx, page);
        String id = UUID.randomUUID().toString();
        sessions.put(id, s);

        if (req.url() != null && !req.url().isBlank()) {
            s.history.steps().add(new Step(
                    StepType.NAVIGATE, req.url(), null, null, null, null, "networkidle", 0,
                    new Viewport(width, height, dpr), System.currentTimeMillis(), ""
            ));
        }

        return new CreateResult(id, screenshot(id));
    }

    public ScreenshotResponse screenshot(String sessionId) {
        return screenshotSession(get(sessionId));
    }

    // --- segmented replay API (NEW) ---

    /** Start a segmented run: reset page, then run until WAIT_FOR_USER or end. */
    public ReplayFrame replayRun(String sessionId, StepsEnvelope steps) {
        // Recreate a fresh context for deterministic replay
        Session old = get(sessionId);
        old.ctx.close();

        BrowserContext ctx = browser.newContext(new Browser.NewContextOptions()
                .setViewportSize(steps.steps().get(0).viewport().width(),
                        steps.steps().get(0).viewport().height())
                .setDeviceScaleFactor(steps.steps().get(0).viewport().deviceScaleFactor())
        );
        Page page = ctx.newPage();

        Session s = new Session(ctx, page);
        sessions.put(sessionId, s);

        s.runningScript = steps;
        s.cursor = 0;
        s.paused = false;
        s.pauseLabel = null;

        return advanceUntilPauseOrEnd(s);
    }

    /** Continue a segmented run from the last cursor. */
    public ReplayFrame replayContinue(String sessionId) {
        Session s = get(sessionId);
        if (s.runningScript == null) {
            throw new RuntimeException("No pending segmented replay for session " + sessionId);
        }
        s.paused = false;
        s.pauseLabel = null;
        return advanceUntilPauseOrEnd(s);
    }

    /** Core segmented runner: apply steps until WAIT_FOR_USER or end. */
    private ReplayFrame advanceUntilPauseOrEnd(Session s) {
        var steps = s.runningScript.steps();
        for (; s.cursor < steps.size(); s.cursor++) {
            Step st = steps.get(s.cursor);

            if (st.type() == StepType.WAIT_FOR_USER) {
                // Move past the pause marker; surface label to the client
                s.cursor++;
                s.paused = true;
                s.pauseLabel = st.label() != null ? st.label()
                        : (st.text() != null ? st.text() : "Waiting for user");
                return new ReplayFrame(screenshotSession(s), true, s.pauseLabel, s.cursor, false);
            }

            applyStep(s, st);
            s.history.steps().add(st);
        }

        // Done
        ScreenshotResponse shot = screenshotSession(s);
        s.runningScript = null;
        s.paused = false;
        s.pauseLabel = null;
        return new ReplayFrame(shot, false, null, s.cursor, true);
    }

    public ScreenshotResponse replay(String sessionId, StepsEnvelope steps) {
        // existing "run all at once" (kept for compatibility)
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
        return screenshotSession(s);
    }

    public StepsEnvelope history(String sessionId) {
        return get(sessionId).history;
    }

    // --- internals ---

    private Session get(String id) {
        Session s = sessions.get(id);
        if (s == null) throw new RuntimeException("Unknown session: " + id);
        return s;
    }

    private ScreenshotResponse screenshotSession(Session s) {
        byte[] buf = s.page.screenshot(new Page.ScreenshotOptions().setFullPage(false));
        String b64 = java.util.Base64.getEncoder().encodeToString(buf);

        int vpW = s.page.viewportSize().width;
        int vpH = s.page.viewportSize().height;

        Object raw = s.page.evaluate("() => Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1");
        double dpr = (raw instanceof Number) ? ((Number) raw).doubleValue() : 1.0;

        return new ScreenshotResponse(b64, vpW, vpH, dpr);
    }

    private void applyStep(Session s, Step step) {
        Page page = s.page;

        try {
            switch (step.type()) {
                case NAVIGATE -> {
                    var opts = new Page.NavigateOptions()
                            .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.LOAD)
                            .setTimeout(60_000);
                    page.navigate(step.url(), opts);
                    try {
                        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE,
                                new Page.WaitForLoadStateOptions().setTimeout(4_000));
                    } catch (PlaywrightException ignored) {}
                }
                case CLICK -> {
                    String before = page.url();
                    page.mouse().move(step.coords().x(), step.coords().y());
                    page.mouse().click(step.coords().x(), step.coords().y());
                    try {
                        page.waitForURL(u -> !u.equals(before),
                                new Page.WaitForURLOptions().setTimeout(6_000));
                    } catch (PlaywrightException ignored) {}
                    try {
                        page.waitForLoadState(com.microsoft.playwright.options.LoadState.LOAD,
                                new Page.WaitForLoadStateOptions().setTimeout(3_000));
                    } catch (PlaywrightException ignored) {}
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
                case SELECT_TEXT -> {
                    SelectionResult sel = selectTextAt(s, step.coords(), step.text());
                    s.selections.add(sel);
                }
                case WAIT_FOR_USER -> {
                    // No-op here. In segmented mode, pause happens in advanceUntilPauseOrEnd().
                    // When recording one-by-one, this simply marks the pause in history.
                }
            }
            if (step.waitAfterMs() != null && step.waitAfterMs() > 0) {
                page.waitForTimeout(step.waitAfterMs());
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to apply step: " + step.type(), e);
        }
    }

    private Path initRecordingsDir() {
        try {
            Path jarDir = Paths.get(SessionService.class.getProtectionDomain()
                    .getCodeSource().getLocation().toURI()).getParent();
            Path dir = jarDir.resolve("recordings");
            Files.createDirectories(dir);
            return dir;
        } catch (Exception ignore) {
            try {
                Path dir = Paths.get("recordings");
                Files.createDirectories(dir);
                return dir;
            } catch (Exception e2) {
                throw new RuntimeException("Cannot create recordings dir", e2);
            }
        }
    }

    private static String sanitize(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private static String timestamp() {
        return DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").format(LocalDateTime.now());
    }

    public Path saveHistoryToFile(String sessionId, String name, boolean overwrite) {
        StepsEnvelope env = history(sessionId);
        String base = sanitize(name == null || name.isBlank() ? ("script-" + timestamp()) : name);
        Path file = recordingsDir.resolve(base.endsWith(".json") ? base : (base + ".json"));

        try {
            if (!overwrite && Files.exists(file)) {
                file = recordingsDir.resolve(base + "-" + timestamp() + ".json");
            }
            json.writeValue(file.toFile(), env);
            return file;
        } catch (Exception e) {
            throw new RuntimeException("Failed to save script to: " + file, e);
        }
    }

    public java.util.List<String> listRecordings() {
        try (var stream = Files.list(recordingsDir)) {
            return stream.filter(p -> p.getFileName().toString().endsWith(".json"))
                    .map(p -> p.getFileName().toString())
                    .sorted()
                    .toList();
        } catch (Exception e) {
            throw new RuntimeException("Failed to list recordings", e);
        }
    }

    public StepsEnvelope loadStepsFromFile(String nameOrPath) {
        Path file = nameOrPath.contains(FileSystems.getDefault().getSeparator())
                ? Paths.get(nameOrPath)
                : recordingsDir.resolve(nameOrPath.endsWith(".json") ? nameOrPath : nameOrPath + ".json");

        try {
            return json.readValue(file.toFile(), StepsEnvelope.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to read: " + file, e);
        }
    }

    public ScreenshotResponse replayFromFile(String sessionId, String nameOrPath) {
        StepsEnvelope env = loadStepsFromFile(nameOrPath);
        return replay(sessionId, env);
    }

    @SuppressWarnings("unchecked")
    private SelectionResult selectTextAt(Session s, Coords coords, String label) {
        String script = """
      ({x, y}) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const getCssPath = (e) => {
          const path = [];
          let cur = e, depth = 0;
          while (cur && cur.nodeType === 1 && depth < 8) {
            let s = cur.nodeName.toLowerCase();
            if (cur.id) { s += '#' + cur.id; path.unshift(s); break; }
            let i = 1, sib = cur;
            while ((sib = sib.previousElementSibling)) if (sib.nodeName === cur.nodeName) i++;
            s += ':nth-of-type(' + i + ')';
            path.unshift(s);
            cur = cur.parentElement; depth++;
          }
          return path.join('>');
        };

        let word = '';
        const cr = (document.caretRangeFromPoint?.(x, y)) ??
                   (document.caretPositionFromPoint?.(x, y) ?
                     (() => { const cp = document.caretPositionFromPoint(x, y);
                              const r = document.createRange(); r.setStart(cp.offsetNode, cp.offset);
                              return r; })() : null);
        if (cr && cr.startContainer && cr.startContainer.nodeType === Node.TEXT_NODE) {
          const text = cr.startContainer.nodeValue || '';
          let i = cr.startOffset, L = text.length, a = i, b = i;
          while (a > 0 && !/\\s/.test(text[a-1])) a--;
          while (b < L && !/\\s/.test(text[b])) b++;
          word = text.slice(a, b);
        }

        const tag = el.tagName.toLowerCase();
        const href = el.closest('a')?.getAttribute('href') || null;
        let full = '';
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          full = el.value || el.placeholder || '';
        } else {
          full = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
        }

        return { text: full, word, selector: getCssPath(el), tag, href };
      }
    """;

        Object result = s.page.evaluate(script, java.util.Map.of("x", coords.x(), "y", coords.y()));
        if (result == null) {
            return new SelectionResult(label, "", "", "", "", null, System.currentTimeMillis());
        }
        var map = (java.util.Map<String, Object>) result;
        String text = map.get("text") != null ? map.get("text").toString() : "";
        String word = map.get("word") != null ? map.get("word").toString() : "";
        String selector = map.get("selector") != null ? map.get("selector").toString() : "";
        String tag = map.get("tag") != null ? map.get("tag").toString() : "";
        String href = map.get("href") != null ? map.get("href").toString() : null;

        return new SelectionResult(label, text, word, selector, tag, href, System.currentTimeMillis());
    }

    public java.util.List<SelectionResult> selections(String sessionId) {
        return java.util.List.copyOf(get(sessionId).selections);
    }

    public void clearSelections(String sessionId) {
        get(sessionId).selections.clear();
    }

    public ScreenshotResponse executeStep(String sessionId, Step step) {
        Session s = get(sessionId);
        // Allow ad-hoc actions even during a segmented run (e.g., user types OTP)
        applyStep(s, step);
        s.history.steps().add(step);
        return screenshotSession(s);
    }
}
