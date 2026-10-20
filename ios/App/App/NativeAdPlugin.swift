import UIKit
import Capacitor
import GoogleMobileAds

/// iOS twin of android/.../NativeAdPlugin.java: an AdMob native ad drawn as a
/// compact card OVER the WebView at a rectangle the page reserves (the win
/// card's #nativeSlot). Same JS name, same methods, same results, same layout
/// and colours, so www/js/ads.js needs no platform branch.
///
///   load({adId})                 -> {loaded, error}
///   show({x, y, width, height})  -> {shown, error}   CSS px, viewport-relative
///   hide()                       -> {hidden}          view gone, ad kept
///   destroy()                    -> {}                view gone, ad released
///
/// Every method RESOLVES: an ad must never be able to break the win card.
/// Written against Google Mobile Ads SDK 13 (the version the AdMob plugin
/// pins), whose Swift names have no GAD prefix. Not compiled on Windows: the
/// first Codemagic build is its compile check.
@objc(NativeAdPlugin)
public class NativeAdPlugin: CAPPlugin, CAPBridgedPlugin, AdLoaderDelegate, NativeAdLoaderDelegate {
    public let identifier = "NativeAdPlugin"
    public let jsName = "ECNativeAd"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroy", returnType: CAPPluginReturnPromise)
    ]

    private var ad: NativeAd?
    private var adView: NativeAdView?
    private var loader: AdLoader?
    private var pendingLoad: CAPPluginCall?

    // MARK: load

    @objc func load(_ call: CAPPluginCall) {
        let adId = call.getString("adId", "")
        if adId.isEmpty { call.resolve(Self.res("loaded", false, "noAdId")); return }
        DispatchQueue.main.async {
            if self.ad != nil { call.resolve(Self.res("loaded", true, nil)); return }
            if self.pendingLoad != nil { call.resolve(Self.res("loaded", false, "busy")); return }
            self.pendingLoad = call
            let choices = NativeAdViewAdOptions()
            choices.preferredAdChoicesPosition = .topRightCorner
            let l = AdLoader(adUnitID: adId,
                             rootViewController: self.bridge?.viewController,
                             adTypes: [.native],
                             options: [choices])
            l.delegate = self
            self.loader = l
            l.load(Request())
        }
    }

    public func adLoader(_ adLoader: AdLoader, didReceive nativeAd: NativeAd) {
        ad = nativeAd
        loader = nil
        pendingLoad?.resolve(Self.res("loaded", true, nil))
        pendingLoad = nil
    }

    public func adLoader(_ adLoader: AdLoader, didFailToReceiveAdWithError error: Error) {
        loader = nil
        let e = error as NSError
        pendingLoad?.resolve(Self.res("loaded", false, "\(e.code): \(e.localizedDescription)"))
        pendingLoad = nil
    }

    // MARK: show / hide / destroy

    @objc func show(_ call: CAPPluginCall) {
        let x = call.getDouble("x", 0), y = call.getDouble("y", 0)
        let w = call.getDouble("width", 0), h = call.getDouble("height", 0)
        DispatchQueue.main.async {
            guard let ad = self.ad else { call.resolve(Self.res("shown", false, "notLoaded")); return }
            if w <= 0 || h <= 0 { call.resolve(Self.res("shown", false, "badRect")); return }
            guard let web = self.bridge?.webView, let host = web.superview else {
                call.resolve(Self.res("shown", false, "noWebView")); return
            }
            self.removeView()
            // CSS px == UIKit points in WKWebView (no page zoom: the viewport
            // meta disables scaling), measured from the WebView's own origin.
            let origin = web.convert(CGPoint(x: x, y: y), to: host)
            let v = Self.buildView(ad)
            v.frame = CGRect(x: origin.x, y: origin.y, width: w, height: h)
            host.addSubview(v)
            host.bringSubviewToFront(v)
            self.adView = v
            call.resolve(Self.res("shown", true, nil))
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let had = self.adView != nil
            self.removeView()
            call.resolve(Self.res("hidden", had, nil))
        }
    }

    /// Native ads are single-use per impression: the page calls this when the
    /// win card closes and then load()s the next one.
    @objc func destroy(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.removeView()
            self.ad = nil
            call.resolve()
        }
    }

    private func removeView() {
        adView?.removeFromSuperview()
        adView = nil
    }

    // MARK: layout (mirrors buildView() in NativeAdPlugin.java)
    // [Ad] badge top-left, AdChoices top-right (placed by the SDK),
    // icon | headline + body | CTA button. Dark slate panel, parchment text,
    // amber CTA, matching the win card.

    private static func color(_ hex: UInt32) -> UIColor {
        UIColor(red: CGFloat((hex >> 16) & 0xff) / 255,
                green: CGFloat((hex >> 8) & 0xff) / 255,
                blue: CGFloat(hex & 0xff) / 255, alpha: 1)
    }

    private static func buildView(_ a: NativeAd) -> NativeAdView {
        let nav = NativeAdView()
        nav.backgroundColor = color(0x1a2338)
        nav.layer.cornerRadius = 14
        nav.layer.borderWidth = 1
        nav.layer.borderColor = color(0x3a4a70).cgColor
        nav.clipsToBounds = true

        let badge = PaddedLabel()
        badge.text = "Ad"
        badge.font = .boldSystemFont(ofSize: 10)
        badge.textColor = color(0x241708)
        badge.backgroundColor = color(0xe8a84c)
        badge.layer.cornerRadius = 4
        badge.clipsToBounds = true
        badge.translatesAutoresizingMaskIntoConstraints = false
        nav.addSubview(badge)

        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 10
        row.translatesAutoresizingMaskIntoConstraints = false
        nav.addSubview(row)

        NSLayoutConstraint.activate([
            badge.leadingAnchor.constraint(equalTo: nav.leadingAnchor, constant: 8),
            badge.topAnchor.constraint(equalTo: nav.topAnchor, constant: 4),
            row.leadingAnchor.constraint(equalTo: nav.leadingAnchor, constant: 10),
            row.trailingAnchor.constraint(equalTo: nav.trailingAnchor, constant: -10),
            row.topAnchor.constraint(equalTo: nav.topAnchor, constant: 16),
            row.bottomAnchor.constraint(equalTo: nav.bottomAnchor, constant: -10)
        ])

        if let img = a.icon?.image {
            let icon = UIImageView(image: img)
            icon.contentMode = .scaleAspectFill
            icon.clipsToBounds = true
            icon.translatesAutoresizingMaskIntoConstraints = false
            icon.widthAnchor.constraint(equalToConstant: 44).isActive = true
            icon.heightAnchor.constraint(equalToConstant: 44).isActive = true
            row.addArrangedSubview(icon)
            nav.iconView = icon
        }

        let text = UIStackView()
        text.axis = .vertical
        text.spacing = 2
        text.setContentHuggingPriority(.defaultLow, for: .horizontal)
        text.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        row.addArrangedSubview(text)

        let headline = UILabel()
        headline.text = a.headline
        headline.textColor = color(0xe9dcc0)
        headline.font = .boldSystemFont(ofSize: 14)
        headline.numberOfLines = 1
        headline.lineBreakMode = .byTruncatingTail
        text.addArrangedSubview(headline)
        nav.headlineView = headline

        if let bodyText = a.body {
            let body = UILabel()
            body.text = bodyText
            body.textColor = color(0x8fa3c8)
            body.font = .systemFont(ofSize: 11.5)
            body.numberOfLines = 2
            body.lineBreakMode = .byTruncatingTail
            text.addArrangedSubview(body)
            nav.bodyView = body
        }

        if let ctaText = a.callToAction {
            let cta = UIButton(type: .custom)
            cta.setTitle(ctaText, for: .normal)
            cta.setTitleColor(color(0x241708), for: .normal)
            cta.titleLabel?.font = .boldSystemFont(ofSize: 12)
            cta.backgroundColor = color(0xe8a84c)
            cta.layer.cornerRadius = 18
            cta.contentEdgeInsets = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)
            // The SDK handles the tap on a registered CTA; the button must not
            // swallow it.
            cta.isUserInteractionEnabled = false
            cta.setContentHuggingPriority(.required, for: .horizontal)
            cta.setContentCompressionResistancePriority(.required, for: .horizontal)
            row.addArrangedSubview(cta)
            nav.callToActionView = cta
        }

        nav.nativeAd = a
        return nav
    }

    private static func res(_ key: String, _ ok: Bool, _ error: String?) -> [String: Any] {
        var o: [String: Any] = [key: ok]
        if let error = error { o["error"] = error }
        return o
    }
}

/// UILabel with the 5 pt side padding the Android badge has.
private class PaddedLabel: UILabel {
    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: UIEdgeInsets(top: 0, left: 5, bottom: 0, right: 5)))
    }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + 10, height: s.height)
    }
}
