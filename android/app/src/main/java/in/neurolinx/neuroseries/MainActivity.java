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
                // Android 10+ (API 29+) ConnectivityManager transport check
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                    if (cm != null) {
                        Network activeNetwork = cm.getActiveNetwork();
                        if (activeNetwork != null) {
                            NetworkCapabilities capabilities = cm.getNetworkCapabilities(activeNetwork);
                            if (capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                                WifiInfo wifiInfo = (WifiInfo) capabilities.getTransportInfo();
                                if (wifiInfo != null && wifiInfo.getSSID() != null) {
                                    String ssid = wifiInfo.getSSID().replace("\"", "").trim();
                                    if (!ssid.equals("<unknown ssid>") && !ssid.isEmpty()) {
                                        android.util.Log.d("AndroidWifiBridge", "getConnectedSsid (TransportInfo): " + ssid);
                                        return ssid;
                                    }
                                }
                            }
                        }
                    }
                }

                // Fallback to WifiManager
                WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    WifiInfo info = wm.getConnectionInfo();
                    if (info != null && info.getSSID() != null) {
                        String ssid = info.getSSID().replace("\"", "").trim();
                        if (!ssid.equals("<unknown ssid>") && !ssid.isEmpty()) {
                            android.util.Log.d("AndroidWifiBridge", "getConnectedSsid (WifiManager): " + ssid);
                            return ssid;
                        }
                    }
                }
            } catch (Exception e) {
                android.util.Log.e("AndroidWifiBridge", "getConnectedSsid error: " + e.getMessage());
            }
            return "";
        }

        @JavascriptInterface
        public String getScanResults() {
            return getSetupScanResults(true);
        }

        @JavascriptInterface
        public String getSetupScanResults(boolean refresh) {
            try {
                WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    try {
                        if (refresh) wm.startScan();
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
                    android.util.Log.d("AndroidWifiBridge", "getScanResults returning " + arr.length() + " items");
                    return arr.toString();
                }
            } catch (Exception e) {
                android.util.Log.e("AndroidWifiBridge", "getScanResults error: " + e.getMessage(), e);
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
        public boolean isLocationEnabled() {
            try {
                android.location.LocationManager lm = (android.location.LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        return lm.isLocationEnabled();
                    } else {
                        return lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) ||
                               lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return true;
        }

        @JavascriptInterface
        public void openLocationSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        private volatile ConnectivityManager.NetworkCallback activeNetworkCallback = null;
        private volatile Network setupNetwork = null;
        private volatile String setupSsid = "";
        private volatile String setupState = "unavailable";

        @JavascriptInterface
        public String getSetupConnectionState(String ssid) {
            return setupSsid.equals(ssid) ? setupState : "unavailable";
        }

        @JavascriptInterface
        public void connectToWifi(String ssid, String password) {
            unbindProcessFromNetwork();
            setupSsid = ssid;
            setupState = "connecting";
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
                        if (activeNetworkCallback != null) {
                            try { cm.unregisterNetworkCallback(activeNetworkCallback); } catch (Exception ignored) {}
                            activeNetworkCallback = null;
                        }

                        activeNetworkCallback = new ConnectivityManager.NetworkCallback() {
                            @Override
                            public void onAvailable(Network network) {
                                if (activeNetworkCallback != this) return;
                                setupNetwork = network;
                                setupState = "connected";
                                // The setup HTTP bridge uses this network directly. Keep
                                // the process on the normal route for authenticated API calls.
                            }

                            @Override
                            public void onLost(Network network) {
                                if (activeNetworkCallback != this) return;
                                setupState = "unavailable";
                                setupNetwork = null;
                            }

                            @Override
                            public void onUnavailable() {
                                if (activeNetworkCallback == this) setupState = "unavailable";
                            }
                        };
                        cm.requestNetwork(request, activeNetworkCallback, 18000);
                        return;
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            setupState = "unavailable";
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
                            boolean bound = cm.bindProcessToNetwork(net);
                            android.util.Log.d("AndroidWifiBridge", "bindProcessToNetwork result: " + bound + " for net: " + net);
                            return bound;
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return false;
        }

        @JavascriptInterface
        public boolean unbindProcessFromNetwork() {
            setupNetwork = null;
            setupSsid = "";
            setupState = "unavailable";
            try {
                ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null) {
                    if (activeNetworkCallback != null) {
                        try {
                            cm.unregisterNetworkCallback(activeNetworkCallback);
                            android.util.Log.d("AndroidWifiBridge", "activeNetworkCallback unregistered successfully");
                        } catch (Exception ignored) {}
                        activeNetworkCallback = null;
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        boolean result = cm.bindProcessToNetwork(null);
                        android.util.Log.d("AndroidWifiBridge", "unbindProcessFromNetwork result: " + result);
                        return result;
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return false;
        }

        @JavascriptInterface
        public String httpPost(String urlString, String jsonBody) {
            android.util.Log.d("AndroidWifiBridge", "httpPost requested for: " + urlString);
            try {
                ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                Network wifiNetwork = setupNetwork;
                if (wifiNetwork == null && cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    for (Network net : cm.getAllNetworks()) {
                        NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                        if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                            wifiNetwork = net;
                            break;
                        }
                    }
                }

                java.net.URL url = new java.net.URL(urlString);
                if (!"http".equals(url.getProtocol()) || !"192.168.4.1".equals(url.getHost()) ||
                        (url.getPort() != -1 && url.getPort() != 80) || url.getUserInfo() != null) {
                    throw new IllegalArgumentException("Invalid device setup address");
                }
                java.net.HttpURLConnection conn;
                if (wifiNetwork != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    conn = (java.net.HttpURLConnection) wifiNetwork.openConnection(url);
                } else {
                    conn = (java.net.HttpURLConnection) url.openConnection();
                }

                conn.setInstanceFollowRedirects(false);
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(7000);
                conn.setDoOutput(true);

                if (jsonBody != null) {
                    byte[] input = jsonBody.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    try (java.io.OutputStream os = conn.getOutputStream()) {
                        os.write(input, 0, input.length);
                    }
                }

                int code = conn.getResponseCode();
                java.io.InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                String responseText = "";
                if (is != null) {
                    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(is, java.nio.charset.StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();
                    responseText = sb.toString();
                }
                JSONObject res = new JSONObject();
                res.put("status", code);
                res.put("ok", code >= 200 && code < 300);
                res.put("body", responseText);
                android.util.Log.d("AndroidWifiBridge", "httpPost success: " + code);
                return res.toString();
            } catch (Exception e) {
                android.util.Log.e("AndroidWifiBridge", "httpPost exception: " + e.getMessage(), e);
                try {
                    JSONObject err = new JSONObject();
                    err.put("status", 0);
                    err.put("ok", false);
                    err.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
                    return err.toString();
                } catch (Exception ignored) {}
                return "{\"status\":0,\"ok\":false,\"error\":\"Network error\"}";
            }
        }

        @JavascriptInterface
        public String httpGet(String urlString) {
            android.util.Log.d("AndroidWifiBridge", "httpGet requested for: " + urlString);
            try {
                ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                Network wifiNetwork = setupNetwork;
                if (wifiNetwork == null && cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    for (Network net : cm.getAllNetworks()) {
                        NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                        if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                            wifiNetwork = net;
                            break;
                        }
                    }
                }

                java.net.URL url = new java.net.URL(urlString);
                if (!"http".equals(url.getProtocol()) || !"192.168.4.1".equals(url.getHost()) ||
                        (url.getPort() != -1 && url.getPort() != 80) || url.getUserInfo() != null) {
                    throw new IllegalArgumentException("Invalid device setup address");
                }
                java.net.HttpURLConnection conn;
                if (wifiNetwork != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    conn = (java.net.HttpURLConnection) wifiNetwork.openConnection(url);
                } else {
                    conn = (java.net.HttpURLConnection) url.openConnection();
                }

                conn.setInstanceFollowRedirects(false);
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(6000);

                int code = conn.getResponseCode();
                java.io.InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                String responseText = "";
                if (is != null) {
                    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(is, java.nio.charset.StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();
                    responseText = sb.toString();
                }
                JSONObject res = new JSONObject();
                res.put("status", code);
                res.put("ok", code >= 200 && code < 300);
                res.put("body", responseText);
                android.util.Log.d("AndroidWifiBridge", "httpGet success: " + code);
                return res.toString();
            } catch (Exception e) {
                android.util.Log.e("AndroidWifiBridge", "httpGet exception: " + e.getMessage(), e);
                try {
                    JSONObject err = new JSONObject();
                    err.put("status", 0);
                    err.put("ok", false);
                    err.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
                    return err.toString();
                } catch (Exception ignored) {}
                return "{\"status\":0,\"ok\":false,\"error\":\"Network error\"}";
            }
        }

        @JavascriptInterface
        public boolean hasInternetConnection() {
            try {
                ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    for (Network net : cm.getAllNetworks()) {
                        NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                        if (caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                            return true;
                        }
                    }
                }
            } catch (Exception ignored) {}
            return false;
        }

        @JavascriptInterface
        public int getNavigationBarHeight() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    android.view.WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
                    if (insets != null) {
                        android.graphics.Insets nav = insets.getInsets(android.view.WindowInsets.Type.navigationBars());
                        float density = context.getResources().getDisplayMetrics().density;
                        return Math.round(nav.bottom / density);
                    }
                }
                int resourceId = context.getResources().getIdentifier("navigation_bar_height", "dimen", "android");
                if (resourceId > 0) {
                    int px = context.getResources().getDimensionPixelSize(resourceId);
                    float density = context.getResources().getDisplayMetrics().density;
                    return Math.round(px / density);
                }
            } catch (Exception ignored) {}
            return 0;
        }

        @JavascriptInterface
        public boolean isGestureNavigation() {
            try {
                int navMode = Settings.Secure.getInt(context.getContentResolver(), "navigation_mode", 0);
                return navMode == 2;
            } catch (Exception ignored) {}
            return false;
        }

        @JavascriptInterface
        public int getStatusBarHeight() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    android.view.WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
                    if (insets != null) {
                        android.graphics.Insets sb = insets.getInsets(android.view.WindowInsets.Type.statusBars());
                        float density = context.getResources().getDisplayMetrics().density;
                        if (sb.top > 0) {
                            return Math.round(sb.top / density);
                        }
                    }
                }
                int resourceId = context.getResources().getIdentifier("status_bar_height", "dimen", "android");
                if (resourceId > 0) {
                    int px = context.getResources().getDimensionPixelSize(resourceId);
                    float density = context.getResources().getDisplayMetrics().density;
                    return Math.round(px / density);
                }
            } catch (Exception ignored) {}
            return 28;
        }

        @JavascriptInterface
        public String nativeApiCall(String urlString, String method, String jsonBody, String authToken) {
            android.util.Log.d("AndroidWifiBridge", "nativeApiCall requested: " + method + " " + urlString);
            try {
                ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                Network targetInternetNet = null;
                if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    // Try to unbind from any dead local SoftAP first
                    if (activeNetworkCallback != null) {
                        try {
                            cm.unregisterNetworkCallback(activeNetworkCallback);
                        } catch (Exception ignored) {}
                        activeNetworkCallback = null;
                    }
                    cm.bindProcessToNetwork(null);

                    // Wait up to 3 seconds for Android OS to finish re-associating with home Wi-Fi or LTE
                    for (int waitCount = 0; waitCount < 6; waitCount++) {
                        for (Network net : cm.getAllNetworks()) {
                            NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                            if (caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                                targetInternetNet = net;
                                break;
                            }
                        }
                        if (targetInternetNet != null) break;
                        try {
                            Thread.sleep(500);
                        } catch (InterruptedException ignored) {}
                    }
                    android.util.Log.d("AndroidWifiBridge", "nativeApiCall resolved targetInternetNet: " + targetInternetNet);
                }

                java.net.URL url = new java.net.URL(urlString);
                final String path = url.getPath();
                final boolean pairingConfig = "GET".equalsIgnoreCase(method) &&
                        path.matches("/neuro-series/api/devices/home/[0-9a-fA-F-]{36}/pairing-config");
                final boolean registerDevice = "POST".equalsIgnoreCase(method) &&
                        "/neuro-series/api/devices/provision".equals(path);
                if (!"https".equals(url.getProtocol()) || !"neurolinx.in".equals(url.getHost()) ||
                        (url.getPort() != -1 && url.getPort() != 443) || url.getUserInfo() != null ||
                        (!pairingConfig && !registerDevice)) {
                    throw new IllegalArgumentException("Invalid pairing API address");
                }
                java.net.HttpURLConnection conn;
                if (targetInternetNet != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    conn = (java.net.HttpURLConnection) targetInternetNet.openConnection(url);
                    android.util.Log.d("AndroidWifiBridge", "nativeApiCall opened connection via internet network: " + targetInternetNet);
                } else {
                    conn = (java.net.HttpURLConnection) url.openConnection();
                }

                conn.setInstanceFollowRedirects(false);
                conn.setRequestMethod(method.toUpperCase());
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "application/json");
                if (authToken != null && !authToken.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + authToken);
                }
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(10000);

                if ("POST".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)) {
                    conn.setDoOutput(true);
                    if (jsonBody != null) {
                        byte[] input = jsonBody.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                        try (java.io.OutputStream os = conn.getOutputStream()) {
                            os.write(input, 0, input.length);
                        }
                    }
                }

                int code = conn.getResponseCode();
                java.io.InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                String responseText = "";
                if (is != null) {
                    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(is, java.nio.charset.StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();
                    responseText = sb.toString();
                }
                JSONObject res = new JSONObject();
                res.put("status", code);
                res.put("ok", code >= 200 && code < 300);
                res.put("body", responseText);
                android.util.Log.d("AndroidWifiBridge", "nativeApiCall success: " + code);
                return res.toString();
            } catch (Exception e) {
                android.util.Log.e("AndroidWifiBridge", "nativeApiCall exception: " + e.getMessage(), e);
                try {
                    JSONObject err = new JSONObject();
                    err.put("status", 0);
                    err.put("ok", false);
                    err.put("error", e.getMessage() != null ? e.getMessage() : e.toString());
                    return err.toString();
                } catch (Exception ignored) {}
                return "{\"status\":0,\"ok\":false,\"error\":\"Network error\"}";
            }
        }

        @JavascriptInterface
        public void setSystemIconsBlack() {
            applySystemBarsAppearance();
        }
    }

    public void applySystemBarsAppearance() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    // Set status bar and navigation bar background color to light blue theme #eaf5fa
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        getWindow().setStatusBarColor(android.graphics.Color.parseColor("#eaf5fa"));
                        getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#eaf5fa"));
                    }

                    // Android 11+ (API 30+) WindowInsetsController
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        android.view.WindowInsetsController controller = getWindow().getInsetsController();
                        if (controller != null) {
                            int appearance = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS |
                                             android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                            controller.setSystemBarsAppearance(appearance, appearance);
                        }
                    } else {
                        // Android 8.0+ (API 26+) / Android 6.0+ (API 23+)
                        int flags = getWindow().getDecorView().getSystemUiVisibility();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                        getWindow().getDecorView().setSystemUiVisibility(flags);
                    }
                } catch (Exception e) {
                    android.util.Log.e("MainActivity", "applySystemBarsAppearance error: " + e.getMessage());
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        applySystemBarsAppearance();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applySystemBarsAppearance();
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceFeaturesPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Ensure status bar and navigation bar have black/dark icons on light background
        applySystemBarsAppearance();
        
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

            // Allow Mixed Content (http calls to 192.168.4.1 from https://localhost)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }

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
