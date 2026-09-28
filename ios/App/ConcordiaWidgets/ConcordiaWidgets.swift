import WidgetKit
import SwiftUI

/// The widget extension's entry point: every widget the app offers.
@main
struct ConcordiaWidgets: WidgetBundle {
    var body: some Widget {
        NextDeadlineWidget()
        NextClassWidget()
        LibraryWidget()
    }
}
