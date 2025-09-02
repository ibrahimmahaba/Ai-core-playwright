package com.MCP.playwright.controllers;


import com.MCP.playwright.dtos.*;
import com.MCP.playwright.services.SessionService;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/remote")
public class RemoteController {
    private final SessionService svc;

    public RemoteController(SessionService svc) {
        this.svc = svc;
    }

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

    @GetMapping("/{sessionId}/selections")
    public SelectionsResponse getSelections(@PathVariable String sessionId) {
        return new SelectionsResponse(svc.selections(sessionId));
    }

    @DeleteMapping("/{sessionId}/selections")
    public void clearSelections(@PathVariable String sessionId) {
        svc.clearSelections(sessionId);
    }

    @GetMapping("/recordings/get")
    public StepsEnvelope getRecording(@RequestParam String name) {
        return svc.loadStepsFromFile(name);  // you already implemented this loader
    }

    @PostMapping("/{sessionId}/replay/async")
    public SessionService.ReplayStatus startAsync(@PathVariable String sessionId, @RequestBody StepsEnvelopeWrapper body) {
        return svc.startReplayAsync(sessionId, body.steps());
    }

    @GetMapping("/{sessionId}/replay/status")
    public SessionService.ReplayStatus status(@PathVariable String sessionId) {
        return svc.replayStatus(sessionId);
    }

    @PostMapping("/{sessionId}/replay/cancel")
    public void cancel(@PathVariable String sessionId) {
        svc.cancelReplay(sessionId);
    }

    // helper wrapper matching your existing JSON shape
    public static record StepsEnvelopeWrapper(StepsEnvelope steps) {
    }

    @GetMapping("/{sessionId}/meta")
    public RecordingMeta getMeta(@PathVariable String sessionId) {
        return svc.history(sessionId).meta(); // may be null during recording
    }

    @PatchMapping("/{sessionId}/meta")
    public RecordingMeta patchSessionMeta(@PathVariable String sessionId,
                                          @RequestBody MetaPatch body) {
        return svc.updateSessionMeta(sessionId, body);  // updates title/description; timestamps: updatedAt only
    }

    @PatchMapping("/recordings/meta")
    public RecordingMeta patchFileMeta(@RequestParam("name") String nameOrPath,
                                       @RequestBody MetaPatch body) {
        return svc.updateFileMeta(nameOrPath, body);    // updates file + timestamps; keeps createdAt if exists
    }


    @PostMapping("/{sessionId}/save/all")
    public Map<String, String> saveAll(@PathVariable String sessionId,
                                       @RequestParam String name,
                                       @RequestBody SaveAllRequest body) {
        Path file = svc.saveAllToFile(sessionId, name, body);
        return Map.of("file", file.toAbsolutePath().toString());
    }


    /*
    Now you have:
        • POST /api/remote/{sessionId}/save/all?name=script-1 — save title+description+steps for the current session.
        • POST /api/remote/recordings/save?name=script-1 — save an entire envelope when you loaded a file without an active session.
     */
    @PostMapping("/recordings/save")
    public Map<String, String> saveRecording(@RequestParam("name") String nameOrPath,
                                             @RequestBody StepsEnvelope env) {
        Path file = svc.saveEnvelopeToFile(nameOrPath, env);
        return Map.of("file", file.toAbsolutePath().toString());
    }


}

