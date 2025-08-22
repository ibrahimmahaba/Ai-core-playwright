package prerna.reactor.playwright;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import prerna.auth.User;
import prerna.auth.utils.SecurityPlaywrightUtils;
import prerna.reactor.AbstractReactor;
import prerna.sablecc2.om.GenRowStruct;
import prerna.sablecc2.om.PixelDataType;
import prerna.sablecc2.om.ReactorKeysEnum;
import prerna.sablecc2.om.nounmeta.NounMetadata;
import prerna.util.git.reactors.SaveAssetReactor;

public class SavePlaywrightFileReactor extends AbstractReactor {
    
    private static final Logger classLogger = LogManager.getLogger(SavePlaywrightFileReactor.class);
    
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
        //String projectId = this.insight.getProjectId();
        
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

            NounMetadata sharedSaveResult = null;
            sharedSaveResult = saveToSharedLocation(jsonContent, fileName, fileId, comment);
            
            String sharedFilePath = "playwright/" + fileId + "_" + fileName;
            
            // register in database with metadata 
            SecurityPlaywrightUtils.registerSharedFile(fileId, fileName, description, user, sharedFilePath);
            
            // set owner permissions
            SecurityPlaywrightUtils.grantFilePermission(fileId, user, "OWNER", user);
            
            // grant additional permissions if specified
            // permissions can be a map
            

            Map<String, Object> result = new HashMap<>();
            result.put("fileId", fileId);
            result.put("fileName", fileName);
            result.put("sharedSave", sharedSaveResult != null ? sharedSaveResult.getValue() : null);
            result.put("success", true);
            result.put("message", "File saved successfully with ID: " + fileId);
            
            return new NounMetadata(result, PixelDataType.MAP);
            
        } catch (Exception e) {
            classLogger.error("Error saving Playwright file", e);
            throw new RuntimeException("Failed to save Playwright file: " + e.getMessage());
        }
    }

    private NounMetadata saveToSharedLocation(String jsonContent, String fileName, String fileId, String comment) {
        // Use SaveAssetReactor to save to shared folder
        SaveAssetReactor saveAssetReactor = new SaveAssetReactor();
        saveAssetReactor.setInsight(this.insight);
        
        // create unique filename with fileId prefix for shared location
        String uniqueFileName = fileId + "_" + fileName;
        
        GenRowStruct fileNameGrs = new GenRowStruct();
        fileNameGrs.add(new NounMetadata("shared/playwright/" + uniqueFileName, PixelDataType.CONST_STRING));
        
        GenRowStruct contentGrs = new GenRowStruct();
        contentGrs.add(new NounMetadata(jsonContent, PixelDataType.CONST_STRING));
        
        GenRowStruct commentGrs = new GenRowStruct();
        commentGrs.add(new NounMetadata(comment + " (shared)", PixelDataType.CONST_STRING));
        
        saveAssetReactor.getNounStore().addNoun(ReactorKeysEnum.FILE_NAME.getKey(), fileNameGrs);
        saveAssetReactor.getNounStore().addNoun(ReactorKeysEnum.CONTENT.getKey(), contentGrs);
        saveAssetReactor.getNounStore().addNoun(ReactorKeysEnum.COMMENT_KEY.getKey(), commentGrs);
        
        return saveAssetReactor.execute();
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