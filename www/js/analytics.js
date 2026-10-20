/* =====================================================================
   Escape Chambers — analytics (Firebase)
   ---------------------------------------------------------------------
   One function: ECAnalytics.log(name, params).

   On device it forwards to @capacitor-firebase/analytics. In the browser
   and under the test suites it sends nothing anywhere. Either way the
   last few events are kept in `recent`, which is what lets a test assert
   "this action logged that event" without a device.

   Rules this file enforces so callers do not have to:
     - it NEVER throws and never returns a rejecting promise. An analytics
       failure must not be able to break a purchase, an ad seam or a win
       card;
     - params are flattened to what Firebase accepts: strings (cut to 100
       chars) and finite numbers. Booleans become 1/0. Anything else is
       dropped rather than sent as "[object Object]".

   Event names in use (keep this list in step with the callers):
     chamber_start        chamber, mode
     chamber_clear        chamber, mode, seconds, stars, hints_used
     hint_used            chamber, mode, step, free
     out_of_hints_shown   can_watch
     shop_open
     purchase_start       product
     purchase_done        product
     ad_shown             format
     rewarded_done        placement
     rate_prompt          action        (shown | rate | later | never)
     daily_hint_claimed   hints
     daily_chamber_clear  streak, stars, seconds
     skip_chamber         chamber, method (video | hints), seconds
   `chamber` is 1..the chamber count, or 0 for the daily chamber; `mode` is main | daily.
   ===================================================================== */
(function (global) {
  'use strict';

  var KEEP = 60;

  function plugin() {
    try {
      var C = global.Capacitor;
      if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
      return (C.Plugins && C.Plugins.FirebaseAnalytics) || null;
    } catch (e) { return null; }
  }

  function clean(params) {
    var out = {};
    if (!params || typeof params !== 'object') return out;
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (typeof v === 'boolean') out[k] = v ? 1 : 0;
      else if (typeof v === 'number') { if (isFinite(v)) out[k] = v; }
      else if (typeof v === 'string') out[k] = v.slice(0, 100);
    });
    return out;
  }

  var Analytics = {
    recent: [],

    log: function (name, params) {
      try {
        var p = clean(params);
        this.recent.push({ name: name, params: p });
        if (this.recent.length > KEEP) this.recent.shift();
        var F = plugin();
        if (!F || !F.logEvent) return;
        var r = F.logEvent({ name: name, params: p });
        if (r && r.catch) r.catch(function (e) {
          console.warn('[analytics] ' + name + ':', e && (e.message || e));
        });
      } catch (e) {
        console.warn('[analytics] ' + name + ' threw:', e);
      }
    }
  };

  global.ECAnalytics = Analytics;
})(window);
