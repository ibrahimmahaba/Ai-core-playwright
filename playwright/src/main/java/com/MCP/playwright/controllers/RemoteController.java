package com.MCP.playwright.controllers;



import com.MCP.playwright.dtos.*;
import com.MCP.playwright.services.SessionService;
import org.springframework.web.bind.annotation.*;

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
}
