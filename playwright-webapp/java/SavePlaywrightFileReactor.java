import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import prerna.auth.User;
// import prerna.auth.utils.SecurityPlaywrightUtils;
import prerna.reactor.AbstractReactor;
import prerna.sablecc2.om.GenRowStruct;
import prerna.sablecc2.om.PixelDataType;
import prerna.sablecc2.om.ReactorKeysEnum;
import prerna.sablecc2.om.nounmeta.NounMetadata;
import prerna.sablecc2.om.execptions.SemossPixelException;
import prerna.util.Constants;
import prerna.util.DIHelper;
import prerna.util.Utility;
import prerna.util.git.reactors.SaveAssetReactor;

public class SavePlaywrightFileReactor extends AbstractReactor {
    
    private static final Logger classLogger = LogManager.getLogger(SavePlaywrightFileReactor.class);
    private static final String DIR_SEPARATOR = File.separator;
    
    public SavePlaywrightFileReactor() {
        this.keysToGet = new String[] {
            "jsonContent",      // JSON content of the recording
            "fileName",         // Name for the file
            "description",      // Description of the recording
            "permissions",     // List of users/permissions to grant access
            "comment"          // Git commit comment
        };
        this.keyRequired = new int[] {1, 1, 0, 0, 0};
    }
    
    @Override
    public NounMetadata execute() {
        organizeKeys();
        
        User user = this.insight.getUser();
        
        String jsonContent = this.keyValue.get(this.keysToGet[0]);
        String fileName = this.keyValue.get(this.keysToGet[1]);
        String description = this.keyValue.get(this.keysToGet[2]);
        String comment = this.keyValue.get(this.keysToGet[4]);
        
        if (jsonContent == null || jsonContent.trim().isEmpty()) {
            throw new IllegalArgumentException("JSON content cannot be empty");
        }
        
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("File name cannot be empty");
        }
        
        // Sanitize filename
        fileName = sanitizeFileName(fileName);
        if (!fileName.endsWith(".json")) {
            fileName += ".json";
        }
        
        if (comment == null) {
            comment = "SavePlaywrightFile: " + fileName;
        }
        
        try {
            String fileId = UUID.randomUUID().toString();

            NounMetadata serverFolderResult = saveToServerFolder(jsonContent, fileName, fileId);
            
            String sharedFilePath = "playwright/" + fileId + "_" + fileName;
            
            // register in database with metadata 
            // SecurityPlaywrightUtils.registerSharedFile(fileId, fileName, description, user, sharedFilePath);
            
            // set owner permissions
            // SecurityPlaywrightUtils.grantFilePermission(fileId, user, "OWNER", user);
            
            // grant additional permissions if specified
            // permissions can be a map
            //to be done

            Map<String, Object> result = new HashMap<>();
            result.put("fileId", fileId);
            result.put("fileName", fileName);
            result.put("serverFolderSave", serverFolderResult != null ? serverFolderResult.getValue() : null);
            result.put("success", true);
            result.put("message", "File saved successfully with ID: " + fileId);
            
            return new NounMetadata(result, PixelDataType.MAP);
            
        } catch (Exception e) {
            classLogger.error("Error saving Playwright file", e);
            throw new RuntimeException("Failed to save Playwright file: " + e.getMessage());
        }
    }

    private NounMetadata saveToServerFolder(String jsonContent, String fileName, String fileId) {
        try {
            // Get the base folder 
            String baseFolder = DIHelper.getInstance().getProperty("BaseFolder");
            if (baseFolder == null || baseFolder.trim().isEmpty()) {
                throw new RuntimeException("BaseFolder property not found in DIHelper");
            }
            
            // create playwright folder at base folder
            // {BaseFolder}/playwright/ 
            String playwrightBaseFolderPath = baseFolder + DIR_SEPARATOR + "playwright";
            File playwrightBaseFolder = new File(playwrightBaseFolderPath);
            if (!playwrightBaseFolder.exists()) {
                playwrightBaseFolder.mkdirs();
                classLogger.info("Created playwright base folder: " + playwrightBaseFolderPath);
            }
            
            String uniqueFileName = fileId + "_" + fileName;
            String filePath = playwrightBaseFolderPath + DIR_SEPARATOR + uniqueFileName;
            
            String decodedContent = Utility.decodeURIComponent(jsonContent);
            
            // save file to playwright folder
            File file = new File(filePath);
            FileUtils.writeStringToFile(file, decodedContent, Charset.forName("UTF-8"));
            
            classLogger.info("Successfully saved Playwright file to server folder: " + filePath);
            
            Map<String, Object> result = new HashMap<>();
            result.put("filePath", filePath);
            result.put("baseFolder", playwrightBaseFolderPath);
            result.put("success", true);
            result.put("message", "File saved to /playwright/ folder");
            
            return new NounMetadata(result, PixelDataType.MAP);
            
        } catch (IOException e) {
            classLogger.error("Error saving file to /playwright folder", e);
            NounMetadata error = NounMetadata.getErrorNounMessage("Unable to save file to semoss/playwright folder: " + fileName);
            SemossPixelException exception = new SemossPixelException(error);
            exception.setContinueThreadOfExecution(false);
            throw exception;
        }
    }
    
    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
    
    @Override
    protected String getDescriptionForKey(String key) {
        switch (key) {
            case "jsonContent": return "JSON content of the Playwright recording";
            case "fileName": return "Name for the saved file";
            case "description": return "Description of the recording";
            case "permissions": return "Map of userId to permission level or comma-separated string 'userId:permission,userId:permission'";
            case "comment": return "Git commit comment";
            default: return super.getDescriptionForKey(key);
        }
    }
}