import Foundation
import AppIntents
import Capacitor

// Siri and Shortcuts.
//
// "Add an assignment in ConcordiaTracker" opens the app on a prefilled
// add-assignment sheet (the course and weight are chosen there: an assignment
// belongs to a course, and Siri is the wrong place to pick one from a list).
// "What's due tomorrow in ConcordiaTracker" answers without opening anything,
// from the same snapshot the Home Screen widgets read.

/// Add an assignment. Opens the app with the title (and due date, if given)
/// filled in, via the same door as a universal link (IncomingLink).
struct AddAssignmentIntent: AppIntent {
    static var title: LocalizedStringResource = "Add an assignment"
    static var description = IntentDescription("Add an assignment to one of your courses.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Title", requestValueDialog: "What's the assignment called?")
    var name: String

    @Parameter(title: "Due")
    var due: Date?

    init() {}

    init(name: String) {
        self.name = name
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        var components = URLComponents()
        components.path = "/app"
        var query = [URLQueryItem(name: "new-assignment", value: name)]
        if let due {
            query.append(URLQueryItem(name: "due", value: ISO8601DateFormatter().string(from: due)))
        }
        components.queryItems = query
        if let path = components.string {
            IncomingLink.open(path: path)
        }
        return .result()
    }
}

enum DueWindow: String, AppEnum {
    case today
    case tomorrow
    case thisWeek

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Day"
    static var caseDisplayRepresentations: [DueWindow: DisplayRepresentation] = [
        .today: "today",
        .tomorrow: "tomorrow",
        .thisWeek: "this week"
    ]
}

/// "What's due tomorrow?" Answered from the App Group snapshot the app keeps
/// current for the widgets (WidgetBridgePlugin), so it works without the app
/// running and without the network.
struct WhatsDueIntent: AppIntent {
    static var title: LocalizedStringResource = "What's due"
    static var description = IntentDescription("Hear what's due today, tomorrow or this week.")

    @Parameter(title: "When", default: .tomorrow)
    var window: DueWindow

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let items = SnapshotReader.deadlines()
        let cal = Calendar.current
        let now = Date()
        let matching = items.filter { d in
            guard d.due > now else { return false }
            switch window {
            case .today: return cal.isDateInToday(d.due)
            case .tomorrow: return cal.isDateInTomorrow(d.due)
            case .thisWeek: return d.due < cal.date(byAdding: .day, value: 7, to: cal.startOfDay(for: now))!
            }
        }
        let when: String
        switch window {
        case .today: when = "today"
        case .tomorrow: when = "tomorrow"
        case .thisWeek: when = "this week"
        }
        guard let first = matching.first else {
            return .result(dialog: IntentDialog(stringLiteral: "Nothing due \(when). Nice."))
        }
        let time = DateFormatter.localizedString(from: first.due, dateStyle: window == .thisWeek ? .medium : .none, timeStyle: .short)
        let lead = first.course.isEmpty ? first.title : "\(first.course) \(first.title)"
        let rest = matching.count - 1
        let tail = rest == 0 ? "" : rest == 1 ? ", and one more" : ", and \(rest) more"
        return .result(dialog: IntentDialog(stringLiteral: "Due \(when): \(lead) at \(time)\(tail)."))
    }
}

struct ConcordiaShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddAssignmentIntent(),
            phrases: [
                "Add an assignment in \(.applicationName)",
                "New assignment in \(.applicationName)"
            ],
            shortTitle: "Add assignment",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: WhatsDueIntent(),
            phrases: [
                "What's due in \(.applicationName)",
                "What's due \(\.$window) in \(.applicationName)"
            ],
            shortTitle: "What's due",
            systemImageName: "calendar"
        )
    }
}

/// Reads the widgets' snapshot (written by src/lib/widget-snapshot.ts). A small
/// reader of its own, because the widget extension's decoder lives in that
/// target and this one only needs three fields.
enum SnapshotReader {
    struct Deadline {
        let title: String
        let course: String
        let due: Date
    }

    static func deadlines() -> [Deadline] {
        guard let json = UserDefaults(suiteName: WidgetBridgePlugin.appGroup)?.string(forKey: WidgetBridgePlugin.snapshotKey),
              let data = json.data(using: .utf8),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let raw = root["deadlines"] as? [[String: Any]] else { return [] }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        return raw.compactMap { d in
            guard let title = d["title"] as? String, let dueRaw = d["due"] as? String,
                  let due = withFraction.date(from: dueRaw) ?? plain.date(from: dueRaw) else { return nil }
            return Deadline(title: title, course: d["course"] as? String ?? "", due: due)
        }.sorted { $0.due < $1.due }
    }
}

/// Tells Siri the student just added an assignment, so it starts suggesting
/// the shortcut.   SiriBridge.donateAddAssignment({ title })
@objc(SiriBridgePlugin)
public class SiriBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SiriBridgePlugin"
    public let jsName = "SiriBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "donateAddAssignment", returnType: CAPPluginReturnPromise)
    ]

    @objc func donateAddAssignment(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "Assignment"
        Task {
            _ = try? await IntentDonationManager.shared.donate(intent: AddAssignmentIntent(name: title))
            call.resolve()
        }
    }
}
