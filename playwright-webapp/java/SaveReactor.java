import prerna.reactor.AbstractReactor;
import prerna.sablecc2.om.nounmeta.NounMetadata;
import prerna.util.AssetUtility;
import prerna.util.Utility;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import prerna.sablecc2.om.PixelDataType;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class SaveReactor extends AbstractReactor {
	
    ObjectMapper json = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

	
	public SaveReactor(){
		this.keysToGet = new String[] {
				"sessionId"
				};
		this.keyRequired = new int[] { 1 };
	}

	@Override
	public NounMetadata execute() {
		organizeKeys();
    	Map<String, Object> paramValues = Utility.getMap(this.store, this.curRow);

		String sessionId = this.keyValue.get(this.keysToGet[0]);
		boolean overwrite = paramValues.get("overwrite") != null ? (boolean) paramValues.get("overwrite"):false;
		return new NounMetadata(saveHistoryToFile(sessionId,
				paramValues.get("name").toString(), overwrite), PixelDataType.MAP);
	}
	
    public Path saveHistoryToFile(String sessionId, String name, boolean overwrite) {
        Path recordingsDir = initRecordingsDir();

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
    
    public StepsEnvelope history(String sessionId) {
        return SessionReactor.get(sessionId).history;
    }
    
	private Path initRecordingsDir() {
        try {
            
            Path dir = Path.of(AssetUtility.getProjectAssetsFolder(this.insight.getContextProjectName(), this.insight.getContextProjectId()), "recordings");
//        	Path dir = Path.of("C:/workspace/Apps/recordings");
            Files.createDirectories(dir);
            return dir;
        } catch (Exception ex) {
            throw new RuntimeException("Cannot create recordings dir", ex);
        }
    }
	

    private String timestamp() {
        return DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").format(LocalDateTime.now());
    }
    
    private String sanitize(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

}
