import UIKit
import Capacitor
import LocalAuthentication
import UserNotifications

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = NeuroBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

private final class NeuroBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(DeviceFeaturesPlugin())
    }
}

@objc(DeviceFeaturesPlugin)
final class DeviceFeaturesPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "DeviceFeaturesPlugin"
    let jsName = "DeviceFeatures"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "biometricStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showNotification", returnType: CAPPluginReturnPromise)
    ]

    @objc func biometricStatus(_ call: CAPPluginCall) {
        let context = LAContext()
        call.resolve(["available": context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let context = LAContext()
            context.localizedFallbackTitle = ""
            guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
                call.reject("Enable Face ID or Touch ID in Settings.")
                return
            }
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock Neuro Series") { success, error in
                context.invalidate()
                if success { call.resolve() }
                else { call.reject(error?.localizedDescription ?? "Authentication cancelled") }
            }
        }
    }

    @objc func notificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let state: String
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: state = "granted"
            case .notDetermined: state = "prompt"
            default: state = "denied"
            }
            call.resolve(["state": state])
        }
    }

    @objc func requestNotifications(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, error in
            if let error = error { call.reject(error.localizedDescription) }
            else { call.resolve(["state": granted ? "granted" : "denied"]) }
        }
    }

    @objc func showNotification(_ call: CAPPluginCall) {
        let content = UNMutableNotificationContent()
        content.title = "Neuro Series"
        content.body = "New device activity. Open Neuro Series for details."
        content.sound = .default
        let request = UNNotificationRequest(identifier: "device-alerts", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error { call.reject(error.localizedDescription) }
            else { call.resolve() }
        }
    }
}
