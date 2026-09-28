import ActivityKit
import Foundation

/// The "next assignment due" Live Activity: the Lock Screen card and the
/// Dynamic Island.
///
/// Compiled into BOTH targets: the app starts, updates and ends it
/// (DeadlineActivityPlugin), the widget extension draws it
/// (DeadlineLiveActivity). A push-to-start from the server
/// (api/_apns.ts liveActivityStartBody) decodes into this exact shape, so the
/// property names here are a contract with that file.
struct DeadlineActivityAttributes: ActivityAttributes {
    /// Fixed for the life of the activity.
    var assessmentId: String
    /// The course's identity colour, "#rrggbb": the island's keyline.
    var colorHex: String
    /// In-app path a tap opens, e.g. /app/courses/<id>?focus=<id>.
    var path: String

    struct ContentState: Codable, Hashable {
        var title: String
        var course: String
        /// Unix seconds. A Double rather than a Date so the server's JSON needs
        /// no agreed Date coding strategy (Date's default is seconds since 2001).
        var dueEpoch: Double
        var outcome: Outcome

        var due: Date { Date(timeIntervalSince1970: dueEpoch) }
    }

    /// How it ends: still counting down, marked done, or run out.
    enum Outcome: String, Codable, Hashable {
        case pending
        case done
        case overdue
    }
}
