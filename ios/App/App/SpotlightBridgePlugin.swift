import Foundation
import UIKit
import Capacitor
import CoreSpotlight
import UniformTypeIdentifiers

/// Makes the student's open assignments findable from Home Screen search.
///
///   SpotlightBridge.replaceAll({ items: [{ id, title, subtitle, path, dueISO }] })
///   SpotlightBridge.clear()
///
/// REPLACE, never patch: the app sends the whole current list each time, so a
/// finished or deleted assignment drops out of the index on the next sync
/// instead of lingering. Each item's unique identifier IS its in-app path, so a
/// tapped result needs no lookup to know where to go (SceneDelegate).
@objc(SpotlightBridgePlugin)
public class SpotlightBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpotlightBridgePlugin"
    public let jsName = "SpotlightBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "replaceAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    static let domain = "com.concordiatracker.assignments"

    @objc func replaceAll(_ call: CAPPluginCall) {
        let raw = call.getArray("items", JSObject.self) ?? []
        let items: [CSSearchableItem] = raw.compactMap { item in
            guard let path = item["path"] as? String, path.hasPrefix("/"),
                  let title = item["title"] as? String else { return nil }
            let attrs = CSSearchableItemAttributeSet(contentType: .content)
            attrs.title = title
            var lines: [String] = []
            if let subtitle = item["subtitle"] as? String, !subtitle.isEmpty { lines.append(subtitle) }
            if let dueISO = item["dueISO"] as? String, let due = Self.parseDate(dueISO) {
                attrs.dueDate = due
                lines.append("Due \(Self.format(due))")
            }
            attrs.contentDescription = lines.joined(separator: " · ")
            attrs.keywords = ["assignment", "due", "deadline"]
            return CSSearchableItem(uniqueIdentifier: path, domainIdentifier: Self.domain, attributeSet: attrs)
        }
        let index = CSSearchableIndex.default()
        index.deleteSearchableItems(withDomainIdentifiers: [Self.domain]) { _ in
            guard !items.isEmpty else {
                call.resolve()
                return
            }
            index.indexSearchableItems(items) { error in
                if let error { call.reject(error.localizedDescription) } else { call.resolve() }
            }
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [Self.domain]) { _ in
            call.resolve()
        }
    }

    private static func format(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: date)
    }

    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }
}

/// Hands an in-app path to the web app the same way a tapped universal link
/// arrives: remembered for a cold start (App.getLaunchUrl) and posted for a
/// running app (the App plugin's appUrlOpen). Spotlight results and Siri both
/// come in through here, so there is one door rather than three.
enum IncomingLink {
    static func open(path: String) {
        guard path.hasPrefix("/"), let url = URL(string: "https://concordiatracker.com\(path)") else { return }
        // Through Capacitor's own universal-link entry point: it records the
        // URL (lastURL is not settable from outside Capacitor) and posts the
        // event, exactly as a tapped concordiatracker.com link would.
        let activity = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
        activity.webpageURL = url
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: activity,
            restorationHandler: { _ in }
        )
    }
}
