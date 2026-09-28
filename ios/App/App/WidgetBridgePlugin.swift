import Foundation
import Capacitor
import WidgetKit

/// Hands the Home Screen widgets their data.
///
/// Widgets run in their own process and cannot read the web view's storage, so
/// the app writes a small JSON snapshot (next deadlines, upcoming classes) into
/// the shared App Group container, and the widget extension reads it from
/// there (ios/App/ConcordiaWidgets/SharedSnapshot.swift). The JSON shape is
/// built in src/lib/widget-snapshot.ts; both sides must agree on it.
///
/// Called as `WidgetBridge.setSnapshot({ json })` and `WidgetBridge.clear()`.
/// Clearing happens on sign-out, so a widget never shows the last person's
/// deadlines.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    /// Must match the App Group in App.entitlements and ConcordiaWidgets.entitlements.
    static let appGroup = "group.com.concordiatracker.app"
    static let snapshotKey = "ct.widget.snapshot"

    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("json is required.")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("The App Group is not available. Check the entitlements.")
            return
        }
        defaults.set(json, forKey: Self.snapshotKey)
        reloadWidgets()
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        UserDefaults(suiteName: Self.appGroup)?.removeObject(forKey: Self.snapshotKey)
        reloadWidgets()
        call.resolve()
    }

    private func reloadWidgets() {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
