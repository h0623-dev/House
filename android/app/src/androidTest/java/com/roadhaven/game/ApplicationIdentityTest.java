package com.roadhaven.game;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run on a connected Android device to verify the update-compatible package identity. */
@RunWith(AndroidJUnit4.class)
public class ApplicationIdentityTest {
    @Test
    public void usesStableApplicationId() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.roadhaven.game", appContext.getPackageName());
    }
}
