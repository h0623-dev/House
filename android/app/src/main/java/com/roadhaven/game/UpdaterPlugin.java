package com.roadhaven.game;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Updates are installed by Android only after the player confirms installation. */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("version", info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode() : info.versionCode);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("앱 버전을 확인하지 못했어요.", error);
        }
    }

    @PluginMethod
    public void openDownload(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("다운로드 주소가 없어요.");
            return;
        }
        Uri uri = Uri.parse(url);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || uri.getHost().isEmpty() || uri.getUserInfo() != null) {
            call.reject("HTTPS 다운로드 주소만 사용할 수 있어요.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("다운로드할 브라우저를 찾을 수 없어요.", error);
        }
    }
}
