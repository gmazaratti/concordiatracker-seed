import UIKit
import Capacitor

/// The app's root view controller: Capacitor's bridge, plus the two plugins
/// that live in this repository rather than in npm.
///
/// Main.storyboard points at this class (customModule "App"). Local plugins are
/// registered here, in `capacitorDidLoad`, because Capacitor only discovers npm
/// plugins automatically; anything written for this app has to be handed to
/// the bridge by name.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
