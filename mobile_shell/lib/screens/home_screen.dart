import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  WebViewController? _webViewController;
  bool _isLoading = true;
  bool _hasError = false;
  bool _useDevServer = false;

  // React UI endpoints
  static const String _bundledAssetPath = 'assets/web_dist/index.html';
  static const String _devServerUrl = 'http://localhost:5173';

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    if (kIsWeb) {
      setState(() {
        _hasError = true;
        _isLoading = false;
      });
      return;
    }

    try {
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.black)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (String url) {
              setState(() {
                _isLoading = true;
                _hasError = false;
              });
            },
            onPageFinished: (String url) {
              setState(() {
                _isLoading = false;
              });
            },
            onWebResourceError: (WebResourceError error) {
              // If dev server fails, fallback to bundled assets automatically
              if (_useDevServer) {
                _loadLocalAssets(fallback: true);
              } else {
                setState(() {
                  _isLoading = false;
                  _hasError = true;
                });
              }
            },
          ),
        );

      _webViewController = controller;
      if (_useDevServer) {
        controller.loadRequest(Uri.parse(_devServerUrl));
      } else {
        controller.loadFlutterAsset(_bundledAssetPath);
      }
    } catch (_) {
      setState(() {
        _hasError = true;
        _isLoading = false;
      });
    }
  }

  void _loadLocalAssets({bool fallback = false}) {
    setState(() {
      _useDevServer = false;
      _isLoading = true;
      _hasError = false;
    });
    _webViewController?.loadFlutterAsset(_bundledAssetPath);
    if (fallback && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Dev server unreachable. Switched to offline built UI.'),
          duration: Duration(seconds: 2),
          backgroundColor: Color(0xFF1E293B),
        ),
      );
    }
  }

  void _loadDevServer() {
    setState(() {
      _useDevServer = true;
      _isLoading = true;
      _hasError = false;
    });
    _webViewController?.loadRequest(Uri.parse(_devServerUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.blueAccent.withAlpha(30),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.bolt, color: Colors.blueAccent, size: 18),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Smart Home Shell',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  _useDevServer ? 'Live Dev Server (:5173)' : 'Embedded React UI',
                  style: TextStyle(
                    color: Colors.white.withAlpha(140),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _useDevServer ? Icons.cloud_done : Icons.offline_pin,
              color: _useDevServer ? Colors.greenAccent : Colors.blueAccent,
            ),
            tooltip: _useDevServer ? 'Switch to Embedded UI' : 'Switch to Dev Server',
            onPressed: () {
              if (_useDevServer) {
                _loadLocalAssets();
              } else {
                _loadDevServer();
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white70),
            tooltip: 'Reload',
            onPressed: () {
              _webViewController?.reload();
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          if (_webViewController != null && !_hasError)
            WebViewWidget(controller: _webViewController!),
          if (_hasError) _buildFallbackPlaceholder(),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.blueAccent),
                strokeWidth: 2.5,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFallbackPlaceholder() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF141414),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF262626)),
              ),
              child: const Icon(
                Icons.wifi_tethering,
                color: Colors.white70,
                size: 44,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'React UI Ready',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Click below to load the embedded offline React dashboard.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withAlpha(160),
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () => _loadLocalAssets(),
              icon: const Icon(Icons.play_arrow, size: 18),
              label: const Text('Load Embedded UI'),
            ),
          ],
        ),
      ),
    );
  }
}
