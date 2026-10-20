import UIKit
import StoreKit
import Capacitor

/// Apple's own "rate this app" sheet. App Store guideline 5.6.1 forbids custom
/// review dialogs, so www/js/rate.js calls this on iOS at exactly the moment
/// Android shows its rating dialog. Apple decides whether the sheet actually
/// appears (at most 3 times in 365 days) and reports nothing back, so the
/// method always resolves {requested}.
@objc(StoreReviewPlugin)
public class StoreReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreReviewPlugin"
    public let jsName = "StoreReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
            guard let scene = scene else {
                call.resolve(["requested": false, "error": "noActiveScene"])
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve(["requested": true])
        }
    }
}
