package in.neurolinx.neuroseries;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configure WebView settings on Capacitor Bridge
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();

            // 1. Enable DOM Storage & JavaScript
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // 2. Google OAuth Compatibility: Strip 'wv' and 'Version/4.0' to prevent 403 disallowed_useragent
            String defaultUa = settings.getUserAgentString();
            String cleanUa = defaultUa.replace("; wv", "").replaceAll("Version/\\d+\\.\\d+\\s+", "");
            settings.setUserAgentString(cleanUa);

            // 3. Accept cookies for Google Sign-In session handling
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);

            // 4. Grant WebRTC Camera permissions directly for QR code scanning
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    request.grant(request.getResources());
                }
            });
        }
    }
}

