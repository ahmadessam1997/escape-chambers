/* =====================================================================
   Escape Chambers — the reminder notification
   ---------------------------------------------------------------------
   ONE local notification ("Your free hint is ready"), scheduled for
   notify.afterHours after the last time the game was used and re-armed
   every time it is used again — so a player who opens the game daily
   never sees it, and one who drifts away gets exactly one nudge, not a
   drip of them.

   PERMISSION IS NEVER REQUESTED AT LAUNCH. Android 13+ shows a system
   dialog for POST_NOTIFICATIONS, and a game that asks before the player
   has done anything gets "Don't allow" by reflex — after which Android
   will not show the dialog again. askOnce() is called by game.js at the
   moment the player first claims a daily hint, which is the one moment
   "want a reminder when the next one is ready?" is a reasonable question.

   The answer lives in ECSave.data.notify:
     'unasked'  never asked. Nothing is scheduled.
     'on'       permission granted; arm() schedules.
     'off'      refused, or switched off in Hints & extras. FINAL: nothing
                here ever re-asks. Only setEnabled(true) — the player's own
                tap on the toggle — tries again.

   In the browser (and wherever the plugin is missing) every entry point
   resolves and does nothing. Nothing here ever rejects.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.ECConfig;
  var Save = global.ECSave;

  function plugin() {
    try {
      var C = global.Capacitor;
      if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
      return (C.Plugins && C.Plugins.LocalNotifications) || null;
    } catch (e) { return null; }
  }

  function conf() { return Cfg.notify || {}; }

  var Notify = {
    /* False in the browser, when the plugin is missing, or when the
       feature is switched off in config — the toggle hides on this. */
    available: function () {
      return conf().enabled !== false && !!plugin();
    },

    enabled: function () { return Save.data.notify === 'on'; },

    /* (Re)schedule the one reminder for afterHours from now. Cancels the
       pending one first, so there is never more than one outstanding. */
    arm: function () {
      var P = plugin();
      if (!P || conf().enabled === false || Save.data.notify !== 'on') {
        return Promise.resolve(false);
      }
      var c = conf();
      var id = c.id || 1001;
      var at = new Date(Date.now() + (c.afterHours || 24) * 3600 * 1000);
      return Promise.resolve()
        .then(function () { return P.cancel({ notifications: [{ id: id }] }); })
        .catch(function () { /* nothing pending is not an error */ })
        .then(function () {
          return P.schedule({ notifications: [{
            id: id,
            title: c.title || 'Your free hint is ready',
            body: c.body || '',
            /* LOAD-BEARING. The plugin defaults this to true, and on
               Android 12+ an exact-wanting schedule() without the
               exact-alarm permission throws the player out to the
               system "Alarms & reminders" screen — where the switch is
               greyed out, because the manifest strips that permission —
               and the call never settles until they come back. Found on
               the emulator in 1.6.0: claiming the daily hint and tapping
               Allow landed in Android settings. */
            isExactNotification: false,
            /* Inexact on purpose: a reminder that lands a few minutes
               late is fine, and exact alarms need a special permission
               on Android 12+ that this app does not hold. */
            schedule: { at: at, allowWhileIdle: false }
          }] });
        })
        .then(function () { return true; })
        .catch(function (e) {
          console.warn('[notify] schedule:', e && (e.message || e));
          return false;
        });
    },

    cancel: function () {
      var P = plugin();
      if (!P) return Promise.resolve();
      return P.cancel({ notifications: [{ id: conf().id || 1001 }] })
        .catch(function () {});
    },

    /* Check, and if Android still owes the player a dialog, show it.
       Resolves true only when notifications are actually allowed. */
    _permit: function () {
      var P = plugin();
      if (!P) return Promise.resolve(false);
      return P.checkPermissions()
        .then(function (r) {
          if (r && r.display === 'granted') return true;
          /* The system dialog pauses the activity; tell ads.js so the
             return from it is not mistaken for coming back to the app. */
          var A = global.ECAds;
          if (A && A.noteHandoff) A.noteHandoff();
          return P.requestPermissions().then(function (r2) {
            return !!(r2 && r2.display === 'granted');
          });
        })
        .catch(function (e) {
          console.warn('[notify] permission:', e && (e.message || e));
          return false;
        });
    },

    /* The ONE automatic ask. Does nothing unless the state is 'unasked',
       so calling it on every daily-hint claim is safe. */
    askOnce: function () {
      var self = this;
      if (!self.available() || Save.data.notify !== 'unasked') {
        return Promise.resolve(Save.data.notify);
      }
      return self._permit().then(function (granted) {
        Save.data.notify = granted ? 'on' : 'off';
        Save.save();
        if (granted) self.arm();
        return Save.data.notify;
      });
    },

    /* The player's own toggle in Hints & extras. Resolves the state that
       actually resulted, which is 'off' when Android refuses. */
    setEnabled: function (want) {
      var self = this;
      if (!want) {
        Save.data.notify = 'off';
        Save.save();
        return self.cancel().then(function () { return 'off'; });
      }
      if (!self.available()) return Promise.resolve(Save.data.notify);
      return self._permit().then(function (granted) {
        Save.data.notify = granted ? 'on' : 'off';
        Save.save();
        if (granted) self.arm();
        return Save.data.notify;
      });
    }
  };

  global.ECNotify = Notify;
})(window);
