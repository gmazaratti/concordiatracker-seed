import UIKit
import Capacitor
import CoreSpotlight

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // MainViewController, not the plain CAPBridgeViewController: it registers
        // the app's own plugins (sign-in sheet, widget data, calendar, Spotlight,
        // the Live Activity, Siri).
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // A Spotlight result that LAUNCHED the app. Capacitor's proxy only
        // knows web links, so it would drop this one.
        for activity in connectionOptions.userActivities where Self.openSpotlight(activity) {
            break
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if Self.openSpotlight(userActivity) { return }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// A tapped Spotlight result: its identifier is the in-app path
    /// (SpotlightBridgePlugin), handed to the web app like any other link.
    private static func openSpotlight(_ activity: NSUserActivity) -> Bool {
        guard activity.activityType == CSSearchableItemActionType,
              let path = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String else { return false }
        IncomingLink.open(path: path)
        return true
    }
}
