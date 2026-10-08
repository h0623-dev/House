package com.roadhaven.game;

import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Downloads stay app-private; Android always confirms APK installation. */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    // One worker also serializes files across Activity/bridge recreation.
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();
    private final Object lock = new Object();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private volatile HttpURLConnection connection;
    private volatile boolean destroyed;
    private SharedPreferences preferences;
    private Release release;
    private volatile String status = "idle";
    private String message = "새 업데이트를 기다리고 있어요.";
    private int progress;
    private long revision;
    private volatile long downloadedBytes;
    private volatile long totalBytes;
    private boolean busy;
    private volatile boolean resumed;
    private volatile boolean pendingInstall;

    private static final class Release {
        final String version;
        final long versionCode;
        final String apkUrl;
        final String sha256;

        Release(String version, long versionCode, String apkUrl, String sha256) throws Exception {
            if (version == null || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[\\w.-]+)?")
                    || version.length() > 100 || versionCode < 1 || versionCode > 2100000000L) {
                throw new IllegalArgumentException("Invalid update version");
            }
            this.version = version; this.versionCode = versionCode;
            this.apkUrl = UpdateArtifactChecks.validateHttpsUrl(apkUrl).toString();
            this.sha256 = UpdateArtifactChecks.normalizeSha256(sha256);
        }

        boolean same(Release other) {
            return other != null && versionCode == other.versionCode && version.equals(other.version)
                    && apkUrl.equals(other.apkUrl) && sha256.equals(other.sha256);
        }

        String json() {
            JSObject data = new JSObject();
            data.put("version", version); data.put("versionCode", versionCode);
            data.put("apkUrl", apkUrl); data.put("sha256", sha256);
            return data.toString();
        }
    }

    @Override public void load() {
        preferences = getContext().getSharedPreferences("road-haven-native-update", 0);
        pendingInstall = preferences.getBoolean("pendingInstall", false);
        try {
            String saved = preferences.getString("release", null);
            if (saved == null) { deletePartial(); return; }
            JSONObject metadata = new JSONObject(saved);
            release = new Release(metadata.getString("version"), metadata.getLong("versionCode"),
                    metadata.getString("apkUrl"), metadata.getString("sha256"));
            if (release.versionCode <= versionCode(installedInfo())) { resetCompleted(); return; }
            // A killed process never makes a partial file installable. Revalidate
            // a complete cache, or restart HTTPS using the persisted release.
            synchronized (lock) { busy = true; }
            publish("downloading", "이전에 받던 업데이트를 확인하고 있어요.", 0, 0, 0);
            Release target = release;
            WORKER.execute(() -> prepareFile(target));
        } catch (Exception error) {
            release = null; pendingInstall = false;
            preferences.edit().clear().apply(); deletePartial(); deletePrepared();
            publish("error", "이전 업데이트 정보를 복구하지 못했어요. 다시 확인해 주세요.", 0, 0, 0);
        }
    }

    @PluginMethod public void getVersion(PluginCall call) {
        try {
            PackageInfo info = installedInfo();
            JSObject result = new JSObject();
            result.put("version", info.versionName); result.put("versionCode", versionCode(info));
            call.resolve(result);
        } catch (Exception error) { call.reject("앱 버전을 확인하지 못했어요.", error); }
    }

    @PluginMethod public void getUpdateState(PluginCall call) { call.resolve(snapshot()); }

    @PluginMethod public void prepareUpdate(PluginCall call) {
        boolean claimedWorker = false;
        try {
            Object rawCode = call.getData().opt("versionCode");
            if (!(rawCode instanceof Number) || ((Number) rawCode).doubleValue() != ((Number) rawCode).longValue()) {
                throw new IllegalArgumentException("Invalid integer version code");
            }
            Release target = new Release(call.getString("version"), ((Number) rawCode).longValue(),
                    call.getString("apkUrl"), call.getString("sha256"));
            if (target.versionCode <= versionCode(installedInfo())) throw new IllegalArgumentException("Update must increase the installed version");
            synchronized (lock) {
                if (busy || (target.same(release) && (status.equals("ready") || status.equals("permission")
                        || status.equals("installing")) && preparedFile().isFile())) {
                    call.resolve(snapshot()); return;
                }
                if (!target.same(release)) { pendingInstall = false; deletePrepared(); }
                release = target; cancelled.set(false); busy = true; claimedWorker = true;
                commit(preferences.edit().putString("release", target.json()).putBoolean("pendingInstall", pendingInstall));
                publish("downloading", "업데이트를 앱 안에서 자동으로 받고 있어요.", 0, 0, 0);
            }
            call.resolve(snapshot());
            WORKER.execute(() -> prepareFile(target));
        } catch (Exception error) {
            if (claimedWorker) synchronized (lock) {
                publish("error", "업데이트를 준비하지 못했어요. 다시 확인해 주세요.", 0, 0, 0);
                busy = false;
            }
            call.reject("업데이트를 준비하지 못했어요. 배포 정보를 다시 확인해 주세요.", error);
        }
    }

    @PluginMethod public void installUpdate(PluginCall call) {
        final Release target;
        synchronized (lock) {
            if (busy || release == null || !preparedFile().isFile()) {
                call.reject("업데이트를 모두 받은 뒤 설치할 수 있어요."); return;
            }
            if (status.equals("installing")) { call.resolve(snapshot()); return; }
            busy = true; target = release;
        }
        WORKER.execute(() -> {
            try {
                verifyArtifact(preparedFile(), target);
                synchronized (lock) {
                    pendingInstall = true;
                    commit(preferences.edit().putBoolean("pendingInstall", true));
                }
                main.post(() -> launchRequestedInstall(call));
            } catch (Exception error) {
                synchronized (lock) {
                    pendingInstall = false;
                    deletePrepared(); preferences.edit().putBoolean("pendingInstall", false).apply();
                    publish("error", "설치 파일 검증에 실패했어요. 업데이트를 다시 받아 주세요.", 0, 0, 0);
                    busy = false;
                }
                call.reject("설치 파일을 검증하지 못했어요.", error);
            }
        });
    }

    @PluginMethod public void cancelUpdate(PluginCall call) {
        try {
            synchronized (lock) {
                if (!status.equals("downloading")) { call.resolve(snapshot()); return; }
                commit(preferences.edit().clear());
                cancelled.set(true); release = null; pendingInstall = false;
            }
        } catch (Exception error) { call.reject("취소 상태를 저장하지 못했어요. 다시 시도해 주세요.", error); return; }
        HttpURLConnection active = connection;
        if (active != null) active.disconnect();
        publish("idle", "업데이트 다운로드를 취소했어요.", 0, 0, 0);
        call.resolve(snapshot());
    }

    private void prepareFile(Release target) {
        try {
            checkCancelled();
            File complete = preparedFile();
            boolean reusable = complete.isFile();
            if (reusable) {
                try { verifyArtifact(complete, target); }
                catch (Exception invalidCache) { deletePrepared(); reusable = false; }
            }
            if (!reusable) {
                download(target); checkCancelled();
                verifyArtifact(partialFile(), target); checkCancelled();
                if (!partialFile().renameTo(complete)) throw new IOException("Cannot commit update file");
            }
            checkCancelled();
            synchronized (lock) {
                publish(pendingInstall && !canInstall() ? "permission" : "ready",
                        "업데이트를 다 받았어요. 설치하기를 누르면 Android 확인 화면이 열려요.",
                        100, complete.length(), complete.length());
                busy = false;
            }
            main.post(() -> { if (!destroyed && resumed && pendingInstall && canInstall()) resumeRequestedInstall(); });
        } catch (Exception error) {
            deletePartial();
            synchronized (lock) {
                if (!destroyed) {
                    if (cancelled.get()) {
                        deletePrepared(); publish("idle", "업데이트 다운로드를 취소했어요.", 0, 0, 0);
                    } else publish("error", "업데이트를 받지 못했어요. 연결을 확인하고 다시 받아 주세요.", 0, 0, 0);
                }
                busy = false;
            }
        } finally {
            HttpURLConnection active = connection; connection = null;
            if (active != null) active.disconnect();
        }
    }

    private void download(Release target) throws Exception {
        File directory = updatesDirectory();
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create private update directory");
        deletePartial();
        URL url = UpdateArtifactChecks.validateHttpsUrl(target.apkUrl);
        for (int redirects = 0; redirects <= 5; redirects++) {
            checkCancelled();
            HttpURLConnection request = (HttpURLConnection) url.openConnection();
            connection = request;
            request.setInstanceFollowRedirects(false);
            request.setConnectTimeout(15000); request.setReadTimeout(30000);
            request.setRequestProperty("Accept-Encoding", "identity");
            request.setRequestProperty("User-Agent", "RoadHaven-Android-Updater");
            int response = request.getResponseCode();
            if (response == 301 || response == 302 || response == 303 || response == 307 || response == 308) {
                String location = request.getHeaderField("Location");
                if (location == null || redirects == 5) throw new IOException("Invalid update redirect");
                url = UpdateArtifactChecks.validateHttpsUrl(new URL(url, location).toString());
                request.disconnect(); continue;
            }
            if (response != 200) throw new IOException("Update HTTP status " + response);
            // getContentLengthLong is unavailable on Android 6 (our minSdk 23).
            String lengthHeader = request.getHeaderField("Content-Length");
            long expected = -1;
            if (lengthHeader != null) {
                try { expected = Long.parseLong(lengthHeader); }
                catch (NumberFormatException invalidLength) { throw new IOException("Invalid update length", invalidLength); }
                if (expected < 0) throw new IOException("Invalid update length");
            }
            if (expected > UpdateArtifactChecks.MAX_APK_BYTES) throw new IOException("Update exceeds the size limit");
            long count = 0; long lastEvent = 0;
            try (InputStream input = request.getInputStream(); FileOutputStream output = new FileOutputStream(partialFile())) {
                byte[] buffer = new byte[64 * 1024]; int read;
                while ((read = input.read(buffer)) != -1) {
                    checkCancelled(); count += read;
                    if (count > UpdateArtifactChecks.MAX_APK_BYTES) throw new IOException("Update exceeds the size limit");
                    output.write(buffer, 0, read);
                    long now = System.nanoTime();
                    if (now - lastEvent >= 400000000L) {
                        publish("downloading", "업데이트를 앱 안에서 자동으로 받고 있어요.",
                                expected > 0 ? (int) Math.min(95, count * 95 / expected) : 0, count, Math.max(0, expected));
                        lastEvent = now;
                    }
                }
                output.getFD().sync();
            }
            if (count == 0 || expected > 0 && count != expected) throw new IOException("Incomplete update download");
            publish("downloading", "다운로드한 파일의 서명과 버전을 확인하고 있어요.", 98, count, count);
            return;
        }
        throw new IOException("Too many redirects");
    }

    private void verifyArtifact(File apk, Release target) throws Exception {
        UpdateArtifactChecks.verifySha256(apk, target.sha256, UpdateArtifactChecks.MAX_APK_BYTES);
        PackageInfo candidate = getContext().getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), signatureFlags());
        if (candidate == null) throw new IOException("Cannot inspect APK package");
        PackageInfo installed = installedInfo();
        UpdateArtifactChecks.verifyIdentity(installed.packageName, versionCode(installed), signers(installed),
                candidate.packageName, versionCode(candidate), signers(candidate), target.versionCode, target.version, candidate.versionName);
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void launchRequestedInstall(PluginCall call) {
        if (destroyed) { synchronized (lock) { busy = false; } if (call != null) call.reject("앱으로 돌아온 뒤 설치를 이어가 주세요."); return; }
        try {
            if (!canInstall()) {
                publish("permission", "이 앱의 업데이트 설치를 허용한 뒤 돌아오면 설치를 이어갈게요.", 100, downloadedBytes, totalBytes);
                getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
            } else {
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", preparedFile());
                Intent installer = new Intent(Intent.ACTION_VIEW);
                installer.setDataAndType(uri, "application/vnd.android.package-archive");
                installer.setClipData(ClipData.newRawUri("Road Haven update", uri));
                installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                // Consume before leaving: cancelling the OS dialog must not
                // automatically open it again on every foreground transition.
                synchronized (lock) { pendingInstall = false; }
                commit(preferences.edit().putBoolean("pendingInstall", false));
                publish("installing", "Android 화면에서 업데이트 설치를 확인해 주세요.", 100, downloadedBytes, totalBytes);
                getActivity().startActivity(installer);
            }
            synchronized (lock) { busy = false; }
            if (call != null) call.resolve(snapshot());
        } catch (Exception error) {
            synchronized (lock) {
                pendingInstall = false;
                preferences.edit().putBoolean("pendingInstall", false).apply();
                publish("ready", "설치 화면을 열지 못했어요. 설치하기를 다시 눌러 주세요.", 100, downloadedBytes, totalBytes);
                busy = false;
            }
            if (call != null) call.reject("Android 설치 화면을 열지 못했어요.", error);
        }
    }

    private void resumeRequestedInstall() {
        final Release target;
        synchronized (lock) {
            if (!pendingInstall || !resumed || busy || release == null || !canInstall()) return;
            busy = true; target = release;
        }
        WORKER.execute(() -> {
            try {
                verifyArtifact(preparedFile(), target);
                main.post(() -> {
                    if (!destroyed && resumed && pendingInstall) launchRequestedInstall(null);
                    else synchronized (lock) { busy = false; }
                });
            } catch (Exception error) {
                synchronized (lock) {
                    pendingInstall = false;
                    preferences.edit().putBoolean("pendingInstall", false).apply();
                    deletePrepared(); publish("error", "설치 파일을 다시 받아 주세요.", 0, 0, 0);
                    busy = false;
                }
            }
        });
    }

    @Override protected void handleOnResume() {
        resumed = true;
        if (pendingInstall && canInstall()) resumeRequestedInstall();
        else if (status.equals("installing")) publish("ready", "설치가 취소됐다면 설치하기를 다시 눌러 주세요.", 100, downloadedBytes, totalBytes);
    }

    @Override protected void handleOnPause() { resumed = false; }

    @Override protected void handleOnDestroy() {
        destroyed = true; resumed = false; cancelled.set(true);
        HttpURLConnection active = connection;
        if (active != null) active.disconnect();
        // Keep verified cache and release metadata for the next process/bridge.
    }

    private void checkCancelled() {
        if (cancelled.get() || Thread.currentThread().isInterrupted()) throw new CancellationException("Cancelled update");
    }

    private PackageInfo installedInfo() throws Exception {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), signatureFlags());
    }

    private int signatureFlags() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    }

    private static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    private static Set<String> signers(PackageInfo info) throws Exception {
        Signature[] certificates = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners() : info.signatures;
        if (certificates == null || certificates.length == 0) throw new IOException("APK has no signing certificate");
        Set<String> result = new HashSet<>();
        for (Signature certificate : certificates) result.add(UpdateArtifactChecks.hex(UpdateArtifactChecks.sha256().digest(certificate.toByteArray())));
        return result;
    }

    private File updatesDirectory() { return new File(getContext().getFilesDir(), "updates"); }
    private File preparedFile() { return new File(updatesDirectory(), "road-haven-update.apk"); }
    private File partialFile() { return new File(updatesDirectory(), "road-haven-download.part"); }
    private void deletePartial() { File file = partialFile(); if (file.exists()) file.delete(); }
    private void deletePrepared() { File file = preparedFile(); if (file.exists()) file.delete(); }

    private static void commit(SharedPreferences.Editor editor) throws IOException {
        if (!editor.commit()) throw new IOException("Cannot persist update state");
    }

    private void resetCompleted() throws IOException {
        release = null; pendingInstall = false;
        deletePartial(); deletePrepared(); commit(preferences.edit().clear());
        publish("idle", "최신 앱으로 여행하고 있어요.", 0, 0, 0);
    }

    private JSObject snapshot() {
        synchronized (lock) {
            JSObject state = new JSObject();
            state.put("status", status); state.put("message", message); state.put("progress", progress);
            state.put("revision", revision);
            state.put("downloadedBytes", downloadedBytes); state.put("totalBytes", totalBytes);
            if (release != null) { state.put("version", release.version); state.put("versionCode", release.versionCode); }
            return state;
        }
    }

    private void publish(String nextStatus, String text, int percent, long bytes, long total) {
        final JSObject state;
        synchronized (lock) {
            status = nextStatus; message = text; progress = Math.max(0, Math.min(100, percent));
            revision++;
            downloadedBytes = bytes; totalBytes = total;
            if (!destroyed && preferences != null) preferences.edit().putString("status", status).apply();
            state = snapshot();
        }
        if (!destroyed) main.post(() -> { if (!destroyed) notifyListeners("updateStateChanged", state); });
    }
}
