import UIKit
import Capacitor
import WebKit

/// The app's root view controller: Capacitor's bridge, plus the plugins that
/// live in this repository rather than in npm.
///
/// Main.storyboard points at this class (customModule "App"). Local plugins are
/// registered here, in `capacitorDidLoad`, because Capacitor only discovers npm
/// plugins automatically; anything written for this app has to be handed to
/// the bridge by name.
///
/// IT DOES NOT TOUCH THE KEYBOARD, deliberately. Three native attempts all
/// moved the web view's FRAME: Capacitor's 'native' resize (a jump after the
/// keyboard landed), a resize on the keyboard notification (a snap), and a
/// display-link resize along the keyboard's curve (build 12). The last one
/// still trailed, because WebKit relays out a resized web view
/// asynchronously: the page was always a frame or more behind the frame, so
/// the composer jumped and a band showed above the keyboard.
///
/// The frame now stays the size of the window. WebKit shrinks the page's
/// VISUAL viewport in step with the keyboard, and lib/native.ts turns that
/// into `--ct-app-h`, so the page follows the keyboard from a single source.
/// capacitor.config.ts keeps the plugin's resize at 'none' to match.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(NativeChromePlugin())
        bridge?.registerPluginInstance(CalendarBridgePlugin())
        bridge?.registerPluginInstance(SpotlightBridgePlugin())
        bridge?.registerPluginInstance(DeadlineActivityPlugin())
        bridge?.registerPluginInstance(FocusActivityPlugin())
        bridge?.registerPluginInstance(SiriBridgePlugin())

        NotificationCenter.default.addObserver(self, selector: #selector(textSizeChanged),
                       name: UIContentSizeCategory.didChangeNotification, object: nil)

        // HIG: the edge swipe goes back, as it does everywhere else on iOS.
        // The app is one page with history entries, so this walks those.
        webView?.allowsBackForwardNavigationGestures = true
        applyTextSize()
    }

    /// DYNAMIC TYPE. The page is CSS, so it cannot read the system text size
    /// itself; zooming the web view by the ratio the system applies to body
    /// text scales every word AND reflows the layout (the CSS viewport gets
    /// narrower), the way Safari's own page zoom does. Clamped: past ~135% the
    /// phone-width layouts stop being usable, and below 90% text gets too small
    /// to read, so the extremes of the slider are honoured only up to there.
    private func applyTextSize() {
        let scale = UIFontMetrics(forTextStyle: .body).scaledValue(for: 17) / 17
        webView?.pageZoom = min(1.35, max(0.9, scale))
    }

    @objc private func textSizeChanged() {
        applyTextSize()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        NativeChromePlugin.apply(NativeChromePlugin.current, to: self)
    }
}

/// Paints the native layers behind the web page in the theme's canvas.
///
/// iOS shows these whenever the page does not cover the screen: during a
/// keyboard transition, a rotation, or an over-scroll. Left at their defaults
/// they are black (the window) and the fixed launch colour (the web view), which
/// is the black band a light theme showed behind the keyboard.
/// Called as `NativeChrome.setBackground({ color: '#rrggbb' })` from
/// ThemeProvider on every theme change.
@objc(NativeChromePlugin)
public class NativeChromePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeChromePlugin"
    public let jsName = "NativeChrome"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setBackground", returnType: CAPPluginReturnPromise)
    ]

    /// The last colour the page asked for, so a view that appears later
    /// (a scene reconnecting) starts in it.
    static var current: UIColor?

    @objc func setBackground(_ call: CAPPluginCall) {
        guard let hex = call.getString("color"), let color = Self.color(hex) else {
            call.reject("color must be #rrggbb.")
            return
        }
        Self.current = color
        DispatchQueue.main.async {
            if let vc = self.bridge?.viewController { Self.apply(color, to: vc) }
            call.resolve()
        }
    }

    static func apply(_ color: UIColor?, to vc: UIViewController) {
        guard let color = color else { return }
        vc.view.window?.backgroundColor = color
        vc.view.backgroundColor = color
        if let web = vc.view as? WKWebView {
            web.isOpaque = true
            web.scrollView.backgroundColor = color
        }
    }

    static func color(_ hex: String) -> UIColor? {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        return UIColor(red: CGFloat((v >> 16) & 0xff) / 255,
                       green: CGFloat((v >> 8) & 0xff) / 255,
                       blue: CGFloat(v & 0xff) / 255,
                       alpha: 1)
    }
}
