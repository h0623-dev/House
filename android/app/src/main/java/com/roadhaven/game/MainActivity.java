package com.roadhaven.game;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.res.Configuration;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterPlugin.class);
        registerPlugin(ContentUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        applyGameTextSize();
        ContentUpdatePlugin.restoreVerifiedContent(this, getBridge());
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyGameTextSize();
    }

    private void applyGameTextSize() {
        // The game lays out text and touch targets together in CSS pixels.
        // Android's independent WebView font enlargement otherwise wraps short
        // Korean control labels while leaving their buttons at the old size.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }
}
