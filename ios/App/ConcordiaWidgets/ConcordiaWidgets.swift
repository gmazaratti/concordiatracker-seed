import WidgetKit
import SwiftUI

/// The widget extension's entry point: every widget the app offers.
@main
struct ConcordiaWidgets: WidgetBundle {
    var body: some Widget {
        NextDeadlineWidget()
        NextClassWidget()
        LibraryWidget()
        // The "next assignment due" Live Activity (Lock Screen + Dynamic Island).
        DeadlineLiveActivity()
        // The focus timer's Live Activity (Dynamic Island + Lock Screen).
        FocusLiveActivity()
    }
}
