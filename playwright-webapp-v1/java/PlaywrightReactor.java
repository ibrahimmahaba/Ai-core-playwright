import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import prerna.util.AssetUtility;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.WaitUntilState;

import prerna.auth.User;
import prerna.reactor.AbstractReactor;
import prerna.sablecc2.om.GenRowStruct;
import prerna.sablecc2.om.PixelDataType;
import prerna.sablecc2.om.ReactorKeysEnum;
import prerna.sablecc2.om.nounmeta.NounMetadata;


public class PlaywrightReactor extends AbstractReactor {
	
//	private final static String REACTOR_DESCRIPTION = "Record and replay flow using playwright";
	private static final Logger classLogger = LogManager.getLogger(PlaywrightReactor.class);

	private final Playwright pw = Playwright.create();
    private Browser browser;
    Path recordingsDir;
    private final ObjectMapper json = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
   // private Path recordingsDir = Path.of(" C:/workspace/Semoss/project/playwrightapp-BE__461bc22e-dfde-4715-81ae-ee3a276b02dd/app_root");
    private final static Map<String, Session> sessions = new ConcurrentHashMap<>();
    
	public PlaywrightReactor() {
		this.keysToGet = new String[] {
				"endpoint", 
				"sessionId", 
				ReactorKeysEnum.PARAM_VALUES_MAP.getKey()};
		this.keyRequired = new int[] { 0 , 0 , 0 };
	}

	@Override
	public NounMetadata execute() {
		organizeKeys();

		browser = pw.chromium().launch(
	            new BrowserType.LaunchOptions().setHeadless(true));
	            
		User user = this.insight.getUser();
        
		recordingsDir = initRecordingsDir();
		
		String endpoint = this.keyValue.get(this.keysToGet[0]);
		String sessionId = this.keyValue.get(this.keysToGet[1]);
    	Map<String, Object> paramValues = getMap();

		switch (endpoint) {
		case "history":
			return new NounMetadata(history(sessionId), PixelDataType.MAP);
		case "save":
			boolean overwrite = paramValues.get("overwrite") != null ? (boolean) paramValues.get("overwrite"):false;
			return new NounMetadata(saveHistoryToFile(sessionId,
					paramValues.get("name").toString(), overwrite), PixelDataType.MAP);

        case "listrecordings":
            return new NounMetadata(listRecordings(), PixelDataType.MAP);

        case "replay":
        	ExecuteStepsRequest executeStepsRequest = json.convertValue(paramValues, ExecuteStepsRequest.class);
            replay(sessionId, executeStepsRequest.steps());
            return new NounMetadata(listRecordings(), PixelDataType.MAP);

        case "replayFile":
            return new NounMetadata(replayFromFile(sessionId, paramValues.get("name").toString()), PixelDataType.MAP);
		case "session": 
			CreateSessionRequest createSessionRequest = json.convertValue(paramValues, CreateSessionRequest.class);
            return new NounMetadata(createAndOpen(createSessionRequest), PixelDataType.MAP);
		case "screenshot":
			return new NounMetadata(screenshot(sessionId), PixelDataType.MAP);
		case "step":
			Step step = json.convertValue(paramValues, Step.class);
            return new NounMetadata(executeStep(sessionId, step), PixelDataType.MAP);
		default:
            return new NounMetadata(true, PixelDataType.BOOLEAN);    
		}

	}
	
    static class Session {
        final BrowserContext ctx;
        final Page page;
        StepsEnvelope history = new StepsEnvelope("1.0", new java.util.ArrayList<>());

        Session(BrowserContext ctx, Page page) {
            this.ctx = ctx; this.page = page;
        }
    }
	
	private Path initRecordingsDir() {
        try {
            // Try: folder next to the running JAR (or target/classes when in IDE)
            //Path jarDir = Paths.get(System.getProperty("user.dir"));
            
            Path dir = Path.of(AssetUtility.getProjectAssetsFolder(this.insight.getContextProjectName(), this.insight.getContextProjectId()), "recordings");

            Files.createDirectories(dir); // creates recordings folder
            return dir;
        } catch (Exception ignore) {
            // Fallback: working dir ./recordings
            throw new RuntimeException("Cannot create recordings dir", ignore);
        }
    }
	
	public record ScreenshotResponse(String base64Png, int width, int height, double deviceScaleFactor) {}
	public enum StepType { NAVIGATE, CLICK, TYPE, SCROLL, WAIT }
	public record Coords(int x, int y) {}
	public record Viewport(int width, int height, double deviceScaleFactor) {}
	public record Step(
	        StepType type,
	        String url,                 // for NAVIGATE
	        Coords coords,              // for CLICK/TYPE/SCROLL
	        String text,                // for TYPE
	        Boolean pressEnter,         // for TYPE
	        Integer deltaY,             // for SCROLL
	        String waitUntil,           // for NAVIGATE
	        Integer waitAfterMs,        // generic wait after action
	        Viewport viewport,          // viewport the coords were computed against
	        Long timestamp
	) {}
	public record ExecuteStepsRequest(StepsEnvelope steps) {}
	public record StepsEnvelope(String version, List<Step> steps) {}
	
    private Session get(String id) {
        Session s = sessions.get(id);
        if (s == null) throw new RuntimeException("Unknown session: " + id);
        return s;
    }
    public record CreateResult(String sessionId, ScreenshotResponse firstShot) {}
    public record CreateSessionRequest(String url, Integer width, Integer height, Double deviceScaleFactor) {}

    private CreateResult createAndOpen(CreateSessionRequest req) {
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

        // record NAVIGATE step if provided
        if (req.url() != null && !req.url().isBlank()) {
            s.history.steps().add(new Step(
                    StepType.NAVIGATE, req.url(), null, null, null, null, "networkidle", 0,
                    new Viewport(width, height, dpr), System.currentTimeMillis()
            ));
        }

        return new CreateResult(id, screenshot(id));
    }
	
	private ScreenshotResponse screenshot(String sessionId) {
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
    
    private void applyStep(Session s, Step step) {
        Page page = s.page;

        try {
            switch (step.type()) {
                case NAVIGATE -> {
                    var opts = new Page.NavigateOptions()
                            .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.LOAD)
                            .setTimeout(60_000);
                    page.navigate(step.url(), opts);

                    // Optional short polish: try network idle without blocking forever
                    try {
                        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE,
                                new Page.WaitForLoadStateOptions().setTimeout(4_000));
                    } catch (PlaywrightException ignored) {}
                }
                case CLICK -> {
                    String before = page.url();

                    // Perform the click
                    page.mouse().move(step.coords().x(), step.coords().y());
                    page.mouse().click(step.coords().x(), step.coords().y());

                    // If navigation happens, wait for it (URL changed)
                    try {
                        page.waitForURL(u -> !u.equals(before),
                                new Page.WaitForURLOptions().setTimeout(6_000)); // waits if it navigates
                    } catch (PlaywrightException ignored) {
                        // No URL change -> stay on same page; that's fine
                    }

                    // Then wait for DOM content to be ready and visible
                    try {
                        page.waitForLoadState(com.microsoft.playwright.options.LoadState.LOAD,
                                new Page.WaitForLoadStateOptions().setTimeout(3_000));
                    } catch (PlaywrightException ignored) {
                        // LOAD didn't come in time; continue (we'll still screenshot)
                    }
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
    
    private static String sanitize(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private static String timestamp() {
        return DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").format(LocalDateTime.now());
    }

    public Path saveHistoryToFile(String sessionId, String name, boolean overwrite) {
        Path recordingsDir = initRecordingsDir(); // ensure dir exists

        StepsEnvelope env = history(sessionId);
        String base = sanitize(name == null || name.isBlank() ? ("script-" + timestamp()) : name);
        Path file = recordingsDir.resolve(base.endsWith(".json") ? base : (base + ".json"));
        
        try {
            if (!overwrite && Files.exists(file)) {
                // add suffix if exists
                file = recordingsDir.resolve(base + ".json");
                System.out.print(file);
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
        return replay(sessionId, env); // your existing deterministic replay
    }
    
	private Map<String, Object> getMap() {
        GenRowStruct mapGrs = this.store.getNoun(ReactorKeysEnum.PARAM_VALUES_MAP.getKey());
        if(mapGrs != null && !mapGrs.isEmpty()) {
            List<NounMetadata> mapInputs = mapGrs.getNounsOfType(PixelDataType.MAP);
            if(mapInputs != null && !mapInputs.isEmpty()) {
                return (Map<String, Object>) mapInputs.get(0).getValue();
            }
        }
        List<NounMetadata> mapInputs = this.curRow.getNounsOfType(PixelDataType.MAP);
        if(mapInputs != null && !mapInputs.isEmpty()) {
            return (Map<String, Object>) mapInputs.get(0).getValue();
        }
        return null;
    }
	
    @Override
    protected String getDescriptionForKey(String key) {
        if(key.equals("endpoint")) {
            return "This is the endpoint to be executed, e.g session, history, listRecordings, replay";
        } else if(key.equals(("sessionId"))) {
            return "The session ID to execute the action for, can be created using session endpoint";
        } else if(key.equals(ReactorKeysEnum.PARAM_VALUES_MAP.getKey())) {
            return "Map containing the parameters needed for each endpoint, e.g {'url':'https://www.google.com'}";
        }
        return super.getDescriptionForKey(key);
    }
}
