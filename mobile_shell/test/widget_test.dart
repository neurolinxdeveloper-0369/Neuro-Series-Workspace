import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_shell/main.dart';
import 'package:mobile_shell/screens/splash_welcome_screen.dart';

void main() {
  testWidgets('SplashWelcomeScreen displays Welcome, User and navigates under 1 second', (WidgetTester tester) async {
    await tester.pumpWidget(const SmartHomeApp());

    // Initially on splash screen
    expect(find.byType(SplashWelcomeScreen), findsOneWidget);
    expect(find.text('Welcome, User'), findsOneWidget);

    // Advance by 750ms (timeout < 1 second)
    await tester.pump(const Duration(milliseconds: 750));
    // Settle transitions
    await tester.pumpAndSettle();

    // After timeout, transitioned away from SplashWelcomeScreen
    expect(find.byType(SplashWelcomeScreen), findsNothing);
  });
}
