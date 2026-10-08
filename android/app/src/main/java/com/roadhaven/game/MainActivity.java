package com.roadhaven.game;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterPlugin.class);
        registerPlugin(ContentUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        ContentUpdatePlugin.restoreVerifiedContent(this, getBridge());
    }
}
