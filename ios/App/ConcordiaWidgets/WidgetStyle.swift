import SwiftUI
import WidgetKit

/// The shared look of the Home Screen widgets, so the four read as one set.
///
/// The hierarchy is the same in every widget: a small tinted badge and a
/// tracked label say WHAT this is; one large rounded figure says the thing you
/// came for (when it is due, which class, how many people); a secondary line
/// gives it context; a quiet footer says where or since when. The course's own
/// colour carries through as a soft wash from the top corner, so a glance
/// tells you which class before you read a word.

/// "NEXT DUE", with a tinted glyph badge.
struct WidgetHeader: View {
    let icon: String
    let title: String
    let tint: Color
    var trailing: String? = nil

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 18, height: 18)
                .background(tint.gradient, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
            if let trailing {
                Text(trailing)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

/// The one big number or word a widget exists to show.
struct WidgetHero: View {
    let text: String
    var color: Color = .primary

    var body: some View {
        Text(text)
            .font(.system(size: 24, weight: .heavy, design: .rounded))
            .foregroundStyle(color)
            .lineLimit(1)
            .minimumScaleFactor(0.55)
    }
}

/// A course code in its own colour: a dot and the code on a soft capsule.
struct CourseTag: View {
    let code: String
    let color: Color

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(code.isEmpty ? "Course" : code)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.16), in: Capsule())
    }
}

/// The background: the system's own surface (so light and dark both follow
/// the Home Screen), with the course colour as a wash from the top corner.
struct WidgetWash: View {
    let tint: Color

    var body: some View {
        ZStack {
            Color(.systemBackground)
            LinearGradient(
                colors: [tint.opacity(0.28), tint.opacity(0.07), .clear],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

extension View {
    /// iOS 17 requires widgets to declare their background; earlier versions do
    /// not have the modifier. One helper so every widget does it the same way.
    @ViewBuilder
    func widgetBackground(tint: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { WidgetWash(tint: tint) }
        } else {
            self.padding().background(WidgetWash(tint: tint))
        }
    }
}
