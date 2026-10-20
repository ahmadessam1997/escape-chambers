package com.ahmadessam.escapechambers;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register before super.onCreate() — Capacitor builds its plugin
        // registry during BridgeActivity.onCreate(), so a plugin added after
        // that call never reaches window.Capacitor.Plugins.
        registerPlugin(NativeAdPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
