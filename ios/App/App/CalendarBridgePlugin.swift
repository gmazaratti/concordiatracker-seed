import Foundation
import Capacitor
import EventKit

/// Writes one assignment into Apple Calendar.
///
///   CalendarBridge.addEvent({ title, notes, url, startISO, endISO })
///     → { status: 'saved' | 'denied' | 'error', message? }
///
/// WRITE-ONLY access (iOS 17): the app adds events and never reads the
/// student's calendar, which is also the smaller thing to ask for. The system
/// prompt appears the first time this is pressed, never at launch
/// (NSCalendarsWriteOnlyAccessUsageDescription in Info.plist).
@objc(CalendarBridgePlugin)
public class CalendarBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CalendarBridgePlugin"
    public let jsName = "CalendarBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "addEvent", returnType: CAPPluginReturnPromise)
    ]

    private let store = EKEventStore()

    @objc func addEvent(_ call: CAPPluginCall) {
        guard let title = call.getString("title"),
              let startISO = call.getString("startISO"),
              let endISO = call.getString("endISO"),
              let start = Self.parseDate(startISO),
              let end = Self.parseDate(endISO) else {
            call.reject("title, startISO and endISO are required.")
            return
        }
        let notes = call.getString("notes") ?? ""
        let link = call.getString("url").flatMap(URL.init(string:))

        store.requestWriteOnlyAccessToEvents { [weak self] granted, _ in
            guard let self else { return }
            guard granted else {
                call.resolve(["status": "denied"])
                return
            }
            let event = EKEvent(eventStore: self.store)
            event.title = title
            event.notes = notes
            event.url = link
            event.startDate = start
            event.endDate = end
            event.calendar = self.store.defaultCalendarForNewEvents
            // The deadline itself deserves a nudge even for people who never
            // set up reminders in the app.
            event.addAlarm(EKAlarm(relativeOffset: -60 * 60))
            do {
                try self.store.save(event, span: .thisEvent, commit: true)
                call.resolve(["status": "saved"])
            } catch {
                call.resolve(["status": "error", "message": error.localizedDescription])
            }
        }
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
