package com.MCP.playwright.controllers;



import com.MCP.playwright.dtos.*;
import com.MCP.playwright.services.SessionService;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/remote")
@CrossOrigin // configure allowed origins in prod
public class RemoteController {
    private final SessionService svc;
    public RemoteController(SessionService svc) { this.svc = svc; }

    @PostMapping("/session")
    public SessionService.CreateResult create(@RequestBody CreateSessionRequest req) {
        return svc.createAndOpen(req);
    }

    @GetMapping("/{sessionId}/screenshot")
    public ScreenshotResponse screenshot(@PathVariable String sessionId) {
        return svc.screenshot(sessionId);
    }

    @PostMapping("/{sessionId}/step")
    public ScreenshotResponse step(@PathVariable String sessionId, @RequestBody ExecuteStepRequest req) {
        return svc.executeStep(sessionId, req.step());
    }

    @PostMapping("/{sessionId}/replay")
    public ScreenshotResponse replay(@PathVariable String sessionId, @RequestBody ExecuteStepsRequest req) {
        return svc.replay(sessionId, req.steps());
    }

    @GetMapping("/{sessionId}/history")
    public StepsEnvelope history(@PathVariable String sessionId) {
        return svc.history(sessionId);
    }

    @PostMapping("/{sessionId}/save")
    public Map<String, String> save(@PathVariable String sessionId,
                                    @RequestParam(defaultValue = "") String name,
                                    @RequestParam(defaultValue = "false") boolean overwrite) {
        Path file = svc.saveHistoryToFile(sessionId, name, overwrite);
        return Map.of("file", file.toAbsolutePath().toString());
    }

    @GetMapping("/recordings")
    public List<String> listRecordings() {
        return svc.listRecordings();
    }

    @PostMapping("/{sessionId}/replay/file")
    public ScreenshotResponse replayFile(@PathVariable String sessionId,
                                         @RequestParam String name) {
        return svc.replayFromFile(sessionId, name);
    }
}

