package com.ahmadessam.escapechambers;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

/**
 * AdMob native ad, drawn as a compact card OVER the WebView at a rectangle
 * the page reserves (the win card's #nativeSlot).
 *
 * Written in-house because @capacitor-community/admob has no native-ad
 * support at all — it only does the full-screen formats and the banner.
 * The Mobile Ads SDK itself is already on the classpath through that
 * plugin; build.gradle pins the same play-services-ads so this class can
 * compile against it.
 *
 * The card is a "native banner": icon, headline, body, call to action, an
 * "Ad" attribution badge and the SDK's AdChoices icon. No MediaView, so no
 * main image asset is displayed — which is allowed, and keeps the card
 * short enough to sit inside the win card without pushing its buttons
 * off a small phone.
 *
 * Same rule as ads.js: every method RESOLVES. An ad must never
 * be able to break the win card.
 *
 * Methods (all RETURN_PROMISE):
 *   load({adId})                 -> {loaded, error}
 *   show({x, y, width, height})  -> {shown, error}   CSS px, viewport-relative
 *   hide()                       -> {hidden}          view gone, ad kept
 *   destroy()                    -> {}                view gone, ad released
 */
@CapacitorPlugin(name = "ECNativeAd")
public class NativeAdPlugin extends Plugin {

    private NativeAd ad = null;
    private NativeAdView view = null;
    private boolean loading = false;

    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void load(final PluginCall call) {
        final String adId = call.getString("adId", "");
        if (TextUtils.isEmpty(adId)) { call.resolve(res("loaded", false, "noAdId")); return; }
        if (ad != null) { call.resolve(res("loaded", true, null)); return; }
        if (loading) { call.resolve(res("loaded", false, "busy")); return; }
        loading = true;
        getActivity().runOnUiThread(() -> {
            try {
                AdLoader loader = new AdLoader.Builder(getContext(), adId)
                    .forNativeAd(nativeAd -> {
                        loading = false;
                        if (getActivity() == null || getActivity().isDestroyed()) {
                            nativeAd.destroy();
                            call.resolve(res("loaded", false, "activityGone"));
                            return;
                        }
                        if (ad != null) ad.destroy();
                        ad = nativeAd;
                        call.resolve(res("loaded", true, null));
                    })
                    .withAdListener(new AdListener() {
                        @Override
                        public void onAdFailedToLoad(LoadAdError e) {
                            loading = false;
                            call.resolve(res("loaded", false, e.getCode() + ": " + e.getMessage()));
                        }
                    })
                    .withNativeAdOptions(new NativeAdOptions.Builder()
                        .setAdChoicesPlacement(NativeAdOptions.ADCHOICES_TOP_RIGHT)
                        .build())
                    .build();
                loader.loadAd(new AdRequest.Builder().build());
            } catch (Throwable t) {
                loading = false;
                call.resolve(res("loaded", false, "exception: " + t.getMessage()));
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void show(final PluginCall call) {
        final double x = call.getDouble("x", 0.0);
        final double y = call.getDouble("y", 0.0);
        final double w = call.getDouble("width", 0.0);
        final double h = call.getDouble("height", 0.0);
        if (ad == null) { call.resolve(res("shown", false, "notLoaded")); return; }
        if (w <= 0 || h <= 0) { call.resolve(res("shown", false, "badRect")); return; }
        getActivity().runOnUiThread(() -> {
            try {
                removeView();
                WebView wv = getBridge().getWebView();
                int[] loc = new int[2];
                wv.getLocationInWindow(loc);
                float d = getContext().getResources().getDisplayMetrics().density;

                view = buildView(getContext(), ad);
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    Math.round((float) w * d), Math.round((float) h * d));
                lp.leftMargin = loc[0] + Math.round((float) x * d);
                lp.topMargin = loc[1] + Math.round((float) y * d);
                lp.gravity = Gravity.TOP | Gravity.START;

                ViewGroup root = getActivity().findViewById(android.R.id.content);
                root.addView(view, lp);
                view.bringToFront();
                call.resolve(res("shown", true, null));
            } catch (Throwable t) {
                removeView();
                call.resolve(res("shown", false, "exception: " + t.getMessage()));
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void hide(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            boolean had = view != null;
            removeView();
            call.resolve(res("hidden", had, null));
        });
    }

    /** Hide and release the ad. Native ads are single-use per impression, so
     *  the page calls this when the win card closes and then load()s the
     *  next one for the next escape. */
    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void destroy(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            removeView();
            if (ad != null) { ad.destroy(); ad = null; }
            call.resolve(new JSObject());
        });
    }

    @Override
    protected void handleOnDestroy() {
        removeView();
        if (ad != null) { ad.destroy(); ad = null; }
    }

    private void removeView() {
        if (view != null) {
            ViewGroup p = (ViewGroup) view.getParent();
            if (p != null) p.removeView(view);
            view = null;
        }
    }

    /* ---- layout, built in code so no XML resource has to ship ----
       [Ad] badge top-left, AdChoices top-right (the SDK places it),
       icon | headline + body | CTA button. Colours follow the game's
       win card: a dark slate panel, parchment text, amber CTA. */
    private NativeAdView buildView(Context c, NativeAd a) {
        NativeAdView nav = new NativeAdView(c);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#1a2338"));
        bg.setCornerRadius(dp(c, 14));
        bg.setStroke(Math.round(dp(c, 1)), Color.parseColor("#3a4a70"));
        nav.setBackground(bg);

        FrameLayout frame = new FrameLayout(c);
        nav.addView(frame, new ViewGroup.LayoutParams(-1, -1));

        LinearLayout row = new LinearLayout(c);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        int pad = Math.round(dp(c, 10));
        row.setPadding(pad, Math.round(dp(c, 16)), pad, pad);
        frame.addView(row, new FrameLayout.LayoutParams(-1, -1));

        TextView badge = new TextView(c);
        badge.setText("Ad");
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setTextColor(Color.parseColor("#241708"));
        GradientDrawable bb = new GradientDrawable();
        bb.setColor(Color.parseColor("#e8a84c"));
        bb.setCornerRadius(dp(c, 4));
        badge.setBackground(bb);
        badge.setPadding(Math.round(dp(c, 5)), 0, Math.round(dp(c, 5)), 0);
        FrameLayout.LayoutParams blp = new FrameLayout.LayoutParams(-2, -2);
        blp.gravity = Gravity.TOP | Gravity.START;
        blp.leftMargin = Math.round(dp(c, 8));
        blp.topMargin = Math.round(dp(c, 4));
        frame.addView(badge, blp);

        ImageView icon = new ImageView(c);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        int is = Math.round(dp(c, 44));
        LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(is, is);
        ilp.rightMargin = Math.round(dp(c, 10));
        if (a.getIcon() != null) {
            icon.setImageDrawable(a.getIcon().getDrawable());
            row.addView(icon, ilp);
            nav.setIconView(icon);
        }

        LinearLayout text = new LinearLayout(c);
        text.setOrientation(LinearLayout.VERTICAL);
        row.addView(text, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView headline = new TextView(c);
        headline.setText(a.getHeadline());
        headline.setTextColor(Color.parseColor("#e9dcc0"));
        headline.setTypeface(Typeface.DEFAULT_BOLD);
        headline.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        headline.setMaxLines(1);
        headline.setEllipsize(TextUtils.TruncateAt.END);
        text.addView(headline);
        nav.setHeadlineView(headline);

        if (a.getBody() != null) {
            TextView body = new TextView(c);
            body.setText(a.getBody());
            body.setTextColor(Color.parseColor("#8fa3c8"));
            body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f);
            body.setMaxLines(2);
            body.setEllipsize(TextUtils.TruncateAt.END);
            text.addView(body);
            nav.setBodyView(body);
        }

        if (a.getCallToAction() != null) {
            Button cta = new Button(c);
            cta.setText(a.getCallToAction());
            cta.setAllCaps(false);
            cta.setTextColor(Color.parseColor("#241708"));
            cta.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            cta.setTypeface(Typeface.DEFAULT_BOLD);
            cta.setMinWidth(0);
            cta.setMinimumWidth(0);
            cta.setMinHeight(0);
            cta.setMinimumHeight(0);
            int cp = Math.round(dp(c, 12));
            cta.setPadding(cp, Math.round(dp(c, 6)), cp, Math.round(dp(c, 6)));
            GradientDrawable cb = new GradientDrawable();
            cb.setColor(Color.parseColor("#e8a84c"));
            cb.setCornerRadius(dp(c, 18));
            cta.setBackground(cb);
            LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(-2, -2);
            clp.leftMargin = Math.round(dp(c, 8));
            row.addView(cta, clp);
            nav.setCallToActionView(cta);
        }

        nav.setNativeAd(a);
        return nav;
    }

    private static float dp(Context c, float v) {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
            c.getResources().getDisplayMetrics());
    }

    private static JSObject res(String key, boolean ok, String error) {
        JSObject o = new JSObject();
        o.put(key, ok);
        if (error != null) o.put("error", error);
        return o;
    }
}
