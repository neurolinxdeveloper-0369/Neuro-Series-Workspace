import 'dart:async';
import 'package:flutter/material.dart';
import 'home_screen.dart';

class SplashWelcomeScreen extends StatefulWidget {
  const SplashWelcomeScreen({super.key});

  @override
  State<SplashWelcomeScreen> createState() => _SplashWelcomeScreenState();
}

class _SplashWelcomeScreenState extends State<SplashWelcomeScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  Timer? _timer;

  // Timeout strictly less than 1 second (750 ms)
  static const Duration _splashTimeout = Duration(milliseconds: 750);

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );

    _controller.forward();

    // Navigate to HomeScreen before 1 second expires
    _timer = Timer(_splashTimeout, () {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) =>
                const HomeScreen(),
            transitionsBuilder:
                (context, animation, secondaryAnimation, child) {
              return FadeTransition(opacity: animation, child: child);
            },
            transitionDuration: const Duration(milliseconds: 200),
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.94, end: 1.0).animate(_fadeAnimation),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Colors.blueAccent.withAlpha(50),
                        Colors.white.withAlpha(15),
                      ],
                    ),
                    border: Border.all(
                      color: Colors.white.withAlpha(50),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.blueAccent.withAlpha(40),
                        blurRadius: 28,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.bolt_rounded,
                    color: Colors.white,
                    size: 38,
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Welcome, User',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Smart Home System',
                  style: TextStyle(
                    color: Colors.white.withAlpha(150),
                    fontSize: 14,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
