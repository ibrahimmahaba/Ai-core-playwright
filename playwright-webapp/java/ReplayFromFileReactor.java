package prerna.reactor.playwright;

import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;

import prerna.reactor.AbstractReactor;
import prerna.sablecc2.om.PixelDataType;
import prerna.sablecc2.om.ReactorKeysEnum;
import prerna.sablecc2.om.nounmeta.NounMetadata;
import prerna.util.AssetUtility;
import prerna.util.Utility;


public class ReplayFromFileReactor extends AbstractReactor {
	
	Path recordingsDir = initRecordingsDir();
    ObjectMapper json = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
	Browser browser;
	
	public ReplayFromFileReactor(){
		this.keysToGet = new String[] {
				ReactorKeysEnum.PARAM_VALUES_MAP.getKey()
				};
		this.keyRequired = new int[] { 1 };
	}

	@Override
	public NounMetadata execute() {
    	Map<String, Object> paramValues = Utility.getMap(this.store, this.curRow);
	    
        return new NounMetadata(replayFromFile(paramValues.get("name").toString()), PixelDataType.MAP);
	}
	
    public ScreenshotResponse replayFromFile(String nameOrPath) {
        StepsEnvelope env = loadStepsFromFile(nameOrPath);
        return replay(env); // your existing deterministic replay
    }
	
	public ScreenshotResponse replay(StepsEnvelope steps) {
        BrowserContext ctx = browser.newContext(new Browser.NewContextOptions()
                .setViewportSize(steps.steps().get(0).viewport().width(),
                        steps.steps().get(0).viewport().height())
                .setDeviceScaleFactor(steps.steps().get(0).viewport().deviceScaleFactor())
        );
        Page page = ctx.newPage();
        Session s = new Session(ctx, page);
        String id = UUID.randomUUID().toString();
        SessionReactor.sessions.put(id, s);

        for (Step st : steps.steps()) StepReactor.applyStep(s, st);
        s.history = steps;
        return ScreenshotReactor.screenshot(id);
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
	
    public List<String> listRecordings() {
        try (var stream = Files.list(recordingsDir)) {
            return stream.filter(p -> p.getFileName().toString().endsWith(".json"))
                    .map(p -> p.getFileName().toString())
                    .sorted()
                    .toList();
        } catch (Exception e) {
            throw new RuntimeException("Failed to list recordings", e);
        }
    }
	
	private Path initRecordingsDir() {
        try {
            
            Path dir = Path.of(AssetUtility.getProjectAssetsFolder(this.insight.getContextProjectName(), this.insight.getContextProjectId()), "recordings");

            Files.createDirectories(dir); // creates recordings folder
            return dir;
        } catch (Exception ex) {
            throw new RuntimeException("Cannot create recordings dir", ex);
        }
    }

}
