import Foundation
import SwiftUI

/// The data the app hands the widgets (see ios/App/App/WidgetBridgePlugin.swift).
///
/// Written by src/lib/widget-snapshot.ts as JSON into the shared App Group, so
/// this Codable shape and that TypeScript shape must agree. Everything the
/// widgets show is computed by the app, which already knows how to parse a
/// meeting time or pick a deadline; the widget only decides what is next
/// relative to "now", because it renders at times the app is not running.
struct WidgetSnapshot: Codable {
    /// When the app wrote this. Old data is labelled, never passed off as live.
    let savedAt: Date
    let deadlines: [Deadline]
    let classes: [ClassSlot]

    struct Deadline: Codable, Identifiable {
        let id: String
        let title: String
        let course: String
        /// The course's identity colour, "#rrggbb".
        let color: String
        let due: Date
        /// "assignment", "quiz", "midterm", "final", …
        let kind: String
    }

    struct ClassSlot: Codable, Identifiable {
        var id: String { "\(code)-\(start.timeIntervalSince1970)" }
        let code: String
        let title: String
        let color: String
        let start: Date
        let end: Date
        let location: String?
    }
}

enum SnapshotStore {
    /// Must match WidgetBridgePlugin.appGroup and both entitlements files.
    static let appGroup = "group.com.concordiatracker.app"
    static let key = "ct.widget.snapshot"

    static func load() -> WidgetSnapshot? {
        guard
            let json = UserDefaults(suiteName: appGroup)?.string(forKey: key),
            let data = json.data(using: .utf8)
        else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { d in
            let raw = try d.singleValueContainer().decode(String.self)
            if let date = ISO8601DateFormatter.withFraction.date(from: raw)
                ?? ISO8601DateFormatter.plain.date(from: raw) {
                return date
            }
            throw DecodingError.dataCorrupted(
                .init(codingPath: d.codingPath, debugDescription: "Bad date \(raw)")
            )
        }
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }
}

extension ISO8601DateFormatter {
    static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}

/// Brand colours, fixed: widgets live on the Home Screen, which has its own
/// light and dark, so they follow the system rather than the in-app theme.
enum Brand {
    static let accent = Color(red: 0x8f / 255.0, green: 0xb3 / 255.0, blue: 0x9a / 255.0)

    static func course(_ hex: String) -> Color {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return accent }
        return Color(
            red: Double((v >> 16) & 0xff) / 255.0,
            green: Double((v >> 8) & 0xff) / 255.0,
            blue: Double(v & 0xff) / 255.0
        )
    }
}

extension View {
    /// iOS 17 requires widgets to declare their background; earlier versions do
    /// not have the modifier. One helper so every widget does it the same way.
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { Color(.systemBackground) }
        } else {
            self.padding().background(Color(.systemBackground))
        }
    }
}

/// "Today 3:00 PM", "Tomorrow", "Mon", "Nov 4": relative to when it renders.
enum Relative {
    static func due(_ date: Date, now: Date) -> String {
        let cal = Calendar.current
        if date < now { return "Overdue" }
        if cal.isDateInToday(date) {
            let f = DateFormatter()
            f.timeStyle = .short
            return "Today \(f.string(from: date))"
        }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: date)).day ?? 0
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate(days < 7 ? "EEE" : "MMM d")
        return f.string(from: date)
    }
}
