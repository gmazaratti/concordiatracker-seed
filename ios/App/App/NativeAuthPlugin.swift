import Foundation
import AuthenticationServices
import Capacitor

/// Google / Apple sign-in through the SYSTEM sign-in sheet.
///
/// Called from src/lib/native-auth.ts as `NativeAuth.start({ url, callbackScheme })`.
/// Opens the provider page in an ASWebAuthenticationSession and resolves with
/// the callback URL once the provider redirects to `callbackScheme://…`.
///
/// Why this instead of the web view: Google refuses OAuth inside an embedded
/// web view ("disallowed_useragent"), and the system sheet is the surface App
/// Review expects for third-party sign-in. It shows the real address bar,
/// shares the person's Safari session (so an account already signed in to
/// Google is one tap), and the app never sees what they type.
///
/// A closed sheet rejects with the message "cancelled", which the JS side
/// treats as a choice rather than an error.
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    /// Held for the life of the sheet: ASWebAuthenticationSession is cancelled
    /// the moment nothing references it.
    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard
            let urlString = call.getString("url"),
            let url = URL(string: urlString),
            let scheme = call.getString("callbackScheme"),
            !scheme.isEmpty
        else {
            call.reject("A url and a callbackScheme are required.")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callbackURL, error in
                self.session = nil
                if let authError = error as? ASWebAuthenticationSessionError,
                   authError.code == .canceledLogin {
                    call.reject("cancelled", "CANCELLED")
                    return
                }
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let callbackURL = callbackURL else {
                    call.reject("The sign-in sheet closed without a result.")
                    return
                }
                call.resolve(["url": callbackURL.absoluteString])
            }
            session.presentationContextProvider = self
            // Share the Safari session: someone already signed in to Google
            // should not have to type their password again.
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("The sign-in sheet could not open.")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.webView?.window ?? ASPresentationAnchor()
    }
}
