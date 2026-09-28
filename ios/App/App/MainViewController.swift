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
/// IT ALSO OWNS THE KEYBOARD. Capacitor's own "native" resize shrinks the web
/// view a quarter-second AFTER the keyboard has finished arriving (it waits for
/// the animation, plus 0.2s), so the page jumped once the keyboard was already
/// up, and during that gap the strip it had not yet given back showed the
/// window's default black. Here the frame changes the moment iOS announces the
/// keyboard, so the composer is already above it while it slides in, and the
/// window, the web view and its scroll view are all painted the theme's canvas
/// (NativeChromePlugin), so nothing revealed during a transition is black.
/// capacitor.config.ts sets the plugin's own resize to 'none' so the two never
/// fight over the frame.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(NativeChromePlugin())
        bridge?.registerPluginInstance(CalendarBridgePlugin())
        bridge?.registerPluginInstance(SpotlightBridgePlugin())
        bridge?.registerPluginInstance(DeadlineActivityPlugin())
        bridge?.registerPluginInstance(SiriBridgePlugin())

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(keyboardWillChange(_:)),
                       name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        nc.addObserver(self, selector: #selector(keyboardWillHide(_:)),
                       name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        NativeChromePlugin.apply(NativeChromePlugin.current, to: self)
    }

    @objc private func keyboardWillChange(_ note: Notification) {
        guard let window = view.window,
              let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue
        else { return }
        // The end frame is in SCREEN coordinates; a floating iPad keyboard or
        // one sliding off the bottom overlaps less than its own height.
        let kb = window.convert(end, from: window.screen.coordinateSpace)
        let overlap = max(0, window.bounds.maxY - kb.minY)
        setWebViewHeight(window.bounds.height - overlap)
    }

    @objc private func keyboardWillHide(_ note: Notification) {
        guard let window = view.window else { return }
        setWebViewHeight(window.bounds.height)
    }

    private func setWebViewHeight(_ height: CGFloat) {
        guard let webView = webView, let window = view.window else { return }
        let target = CGRect(x: 0, y: 0, width: window.bounds.width, height: height)
        if webView.frame != target { webView.frame = target }
        // WKWebView scrolls itself to reveal a focused field. The page is sized
        // to what is visible now, so there is nothing to reveal, and that scroll
        // is what lifted the whole interface out of place.
        webView.scrollView.contentOffset = .zero
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
