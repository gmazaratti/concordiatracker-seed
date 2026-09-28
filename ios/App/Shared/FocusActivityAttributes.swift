import ActivityKit
import Foundation

/// The focus timer's Live Activity: the Dynamic Island and the Lock Screen
/// while a 25-minute focus block (or a 5-minute break) is running.
///
/// Compiled into BOTH targets, like DeadlineActivityAttributes: the app starts,
/// pauses and ends it (FocusActivityPlugin), the widget extension draws it
/// (FocusLiveActivity).
struct FocusActivityAttributes: ActivityAttributes {
    /// The full length of this block in seconds, for the progress bar.
    var totalSeconds: Double

    struct ContentState: Codable, Hashable {
        /// "focus" or "break".
        var mode: String
        /// Unix seconds the block ends, while it runs.
        var endsEpoch: Double
        /// Seconds left while PAUSED; nil while it runs. A paused timer must
        /// not keep counting in the island.
        var pausedRemaining: Double?

        var ends: Date { Date(timeIntervalSince1970: endsEpoch) }
        var isBreak: Bool { mode == "break" }
    }
}
