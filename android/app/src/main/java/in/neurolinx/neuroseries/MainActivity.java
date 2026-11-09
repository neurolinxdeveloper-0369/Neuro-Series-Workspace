package in.neurolinx.neuroseries;

import android.Manifest;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.provider.Settings;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int CAMERA_PERMISSION_REQ_CODE = 101;

    // Native Android Wi-Fi Bridge exposed to WebView JavaScript as window.AndroidWifiBridge
    public class AndroidWifiBridge {
        private final Context context;

        public AndroidWifiBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public String getConnectedSsid() {
            try {
                WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    WifiInfo info = wm.getConnectionInfo();
                    if (info != null && info.getSSID() != null) {
                        String ssid = info.getSSID().replace("\"", "").trim();
                        if (!ssid.equals("<unknown ssid>") && !ssid.isEmpty()) {
                            return ssid;
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return "";
        }

        @JavascriptInterface
        public String getScanResults() {
            try {
                WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    try {
                        wm.startScan();
                    } catch (Exception ignored) {}
                    List<ScanResult> results = wm.getScanResults();
                    JSONArray arr = new JSONArray();
                    if (results != null) {
                        for (ScanResult r : results) {
                            if (r.SSID != null && !r.SSID.isEmpty()) {
                                JSONObject obj = new JSONObject();
                                obj.put("ssid", r.SSID);
                                obj.put("bssid", r.BSSID);
                                obj.put("level", r.level);
                                obj.put("frequency", r.frequency);
                                arr.put(obj);
                            }
                        }
                    }
                    return arr.toString();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return "[]";
        }

        @JavascriptInterface
        public void openWifiSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void connectToWifi(String ssid, String password) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    android.net.wifi.WifiNetworkSpecifier.Builder builder = new android.net.wifi.WifiNetworkSpecifier.Builder()
                        .setSsid(ssid);
                    if (password != null && !password.isEmpty()) {
                        builder.setWpa2Passphrase(password);
                    }
                    android.net.wifi.WifiNetworkSpecifier specifier = builder.build();

                    android.net.NetworkRequest request = new android.net.NetworkRequest.Builder()
                        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                        .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .setNetworkSpecifier(specifier)
                        .build();

                    ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                    if (cm != null) {
                        cm.requestNetwork(request, new ConnectivityManager.NetworkCallback() {
                            @Override
                            public void onAvailable(Network network) {
                                super.onAvailable(network);
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                    cm.bindProcessToNetwork(network);
                                }
                            }
                        });
                        return;
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            openWifiSettings();
        }

        @JavascriptInterface
        public boolean bindProcessToWifi() {
            try {
                ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    for (Network net : cm.getAllNetworks()) {
                        NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                        if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                            return cm.bindProcessToNetwork(net);
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return false;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Runtime camera, location, and Wi-Fi permissions for Android 6.0+ (API 23+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] perms;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                perms = new String[]{
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.NEARBY_WIFI_DEVICES
                };
            } else {
                perms = new String[]{
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                };
            }
            ActivityCompat.requestPermissions(this, perms, CAMERA_PERMISSION_REQ_CODE);
        }

        // Configure WebView settings on Capacitor Bridge
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();

            // Register native Android Wi-Fi Bridge
            webView.addJavascriptInterface(new AndroidWifiBridge(MainActivity.this), "AndroidWifiBridge");

            // 1. Enable DOM Storage, JavaScript & Multi-Window support
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setSupportMultipleWindows(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);

            // 2. Google OAuth Compatibility: Strip 'wv' and 'Version/4.0' to prevent 403 disallowed_useragent
            String defaultUa = settings.getUserAgentString();
            final String cleanUa = defaultUa.replace("; wv", "").replaceAll("Version/\\d+\\.\\d+\\s+", "");
            settings.setUserAgentString(cleanUa);

            // 3. Accept cookies for Google Sign-In session handling
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);

            // 4. WebChromeClient for Camera permissions & Google Sign-In popup modal support
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    MainActivity.this.runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            request.grant(request.getResources());
                        }
                    });
                }

                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    final Dialog dialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                    final WebView popupWebView = new WebView(MainActivity.this);

                    WebSettings popupSettings = popupWebView.getSettings();
                    popupSettings.setJavaScriptEnabled(true);
                    popupSettings.setDomStorageEnabled(true);
                    popupSettings.setDatabaseEnabled(true);
                    popupSettings.setSupportMultipleWindows(true);
                    popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                    popupSettings.setUserAgentString(cleanUa);

                    CookieManager.getInstance().setAcceptCookie(true);
                    CookieManager.getInstance().setAcceptThirdPartyCookies(popupWebView, true);

                    popupWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                            return false;
                        }
                    });

                    popupWebView.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onCloseWindow(WebView window) {
                            dialog.dismiss();
                            popupWebView.destroy();
                        }
                    });

                    dialog.setContentView(popupWebView, new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, 
                        ViewGroup.LayoutParams.MATCH_PARENT
                    ));
                    dialog.setOnCancelListener(dialogInterface -> {
                        popupWebView.destroy();
                    });
                    dialog.show();

                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(popupWebView);
                    resultMsg.sendToTarget();
                    return true;
                }
            });
        }
    }
}
