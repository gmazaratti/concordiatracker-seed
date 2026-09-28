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
/// view a quarter-second AFTER the keyboard has finished arriving, so the page
/// jumped once the keyboard was already up. Setting the frame the moment iOS
/// announced the keyboard fixed that but made the page SNAP to its final size
/// while the keyboard was still sliding.
///
/// So the frame now MOVES WITH THE KEYBOARD, on the keyboard's own curve:
/// an invisible probe view is animated with exactly the duration and curve iOS
/// hands us in the notification (including curve 7, the private spring the
/// keyboard itself uses), and a display link copies the probe's in-flight
/// height onto the web view every frame. The page lays out at each
/// intermediate height, so the composer rides up with the keyboard's top edge
/// and there is never a gap between them. The window, the web view and its
/// scroll view are painted the theme's canvas (NativeChromePlugin), so nothing
/// revealed during a transition is black. capacitor.config.ts sets the
/// plugin's own resize to 'none' so the two never fight over the frame.
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

        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(keyboardWillChange(_:)),
                       name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        nc.addObserver(self, selector: #selector(keyboardWillHide(_:)),
                       name: UIResponder.keyboardWillHideNotification, object: nil)
        nc.addObserver(self, selector: #selector(textSizeChanged),
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

    @objc private func keyboardWillChange(_ note: Notification) {
        guard let window = view.window,
              let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue
        else { return }
        // The end frame is in SCREEN coordinates; a floating iPad keyboard or
        // one sliding off the bottom overlaps less than its own height.
        let kb = window.convert(end, from: window.screen.coordinateSpace)
        let overlap = max(0, window.bounds.maxY - kb.minY)
        animateWebViewHeight(to: window.bounds.height - overlap, alongside: note)
    }

    @objc private func keyboardWillHide(_ note: Notification) {
        guard let window = view.window else { return }
        animateWebViewHeight(to: window.bounds.height, alongside: note)
    }

    // MARK: Keyboard-synchronised resize

    /// Never shown; only its presentation layer is read, as the keyboard's curve.
    private let keyboardProbe: UIView = {
        let v = UIView(frame: .zero)
        v.isUserInteractionEnabled = false
        v.alpha = 0
        return v
    }()
    private var keyboardLink: CADisplayLink?
    /// Bumped per animation. iOS sends two notifications for one hide (will-
    /// change-frame, then will-hide) with the same target; the first
    /// animation's completion fires after the second has started, and must not
    /// snap the frame or stop the display link the second one is using.
    private var keyboardGeneration = 0
    /// Where the running animation is heading, so the duplicate notification
    /// for the same move is ignored instead of restarting the curve midway.
    private var keyboardHeading: CGFloat?

    private func animateWebViewHeight(to target: CGFloat, alongside note: Notification) {
        guard let webView = webView else { return }
        let info = note.userInfo
        let duration = (info?[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
        let curveRaw = (info?[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber)?.uintValue ?? 7
        let from = webView.frame.height
        if keyboardLink != nil, let heading = keyboardHeading, abs(heading - target) < 1 { return }
        keyboardGeneration += 1
        let generation = keyboardGeneration
        keyboardHeading = target

        // Nothing to animate (a hardware keyboard, Reduce Motion's zero
        // duration, or a repeat notification): just land there.
        if duration <= 0 || abs(from - target) < 1 {
            stopKeyboardLink()
            setWebViewHeight(target)
            return
        }

        if keyboardProbe.superview == nil { view.addSubview(keyboardProbe) }
        // Start from where the web view actually is, so a hide that interrupts
        // a show continues from the middle rather than jumping.
        keyboardProbe.layer.removeAllAnimations()
        keyboardProbe.frame = CGRect(x: 0, y: 0, width: 1, height: from)

        let options = UIView.AnimationOptions(rawValue: curveRaw << 16)
        UIView.animate(withDuration: duration, delay: 0, options: [options, .beginFromCurrentState], animations: {
            self.keyboardProbe.frame = CGRect(x: 0, y: 0, width: 1, height: target)
        }, completion: { [weak self] _ in
            guard let self = self, self.keyboardGeneration == generation else { return }
            self.stopKeyboardLink()
            // Land exactly on the target whatever the last frame read.
            self.setWebViewHeight(target)
        })

        if keyboardLink == nil {
            let link = CADisplayLink(target: self, selector: #selector(keyboardTick))
            if #available(iOS 15.0, *) {
                link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
            }
            link.add(to: .main, forMode: .common)
            keyboardLink = link
        }
    }

    @objc private func keyboardTick() {
        guard let height = keyboardProbe.layer.presentation()?.bounds.height else { return }
        setWebViewHeight(height.rounded())
    }

    private func stopKeyboardLink() {
        keyboardLink?.invalidate()
        keyboardLink = nil
        keyboardHeading = nil
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
