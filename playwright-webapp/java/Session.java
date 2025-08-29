import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;

public class Session {
	
	private final BrowserContext ctx;
    final Page page;
    StepsEnvelope history = new StepsEnvelope(new java.util.ArrayList<>());

    Session(BrowserContext ctx, Page page) {
        this.ctx = ctx; this.page = page;
    }

}
