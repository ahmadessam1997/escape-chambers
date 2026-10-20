import UIKit
import Capacitor

/// Hosts the game's WebView and registers the plugins that live in this app
/// target rather than in an npm package (the iOS twins of the Android-only
/// classes under android/app/src/main/java):
///   ECNativeAd   <- NativeAdPlugin.java   (native ad card on the win screen)
///   StoreReview  <- iOS only: Apple's review request, used where Android shows
///                   the custom rating dialog (www/js/rate.js)
/// Main.storyboard points its view controller at this class.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAdPlugin())
        bridge?.registerPluginInstance(StoreReviewPlugin())
    }
}
