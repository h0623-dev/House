package com.roadhaven.game;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.Base64;
import android.util.AtomicFile;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Signed game content changes the private web root while retaining https://localhost and its save data. */
@CapacitorPlugin(name = "ContentUpdater")
public class ContentUpdatePlugin extends Plugin {
    private static final String MANIFEST_URL = "https://raw.githubusercontent.com/h0623-dev/House/gh-pages/game-update.json";
    private static final String PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAELHPgvnbTdcAhXmHJKWxONcIMOTTqGLgGJe2cJPtFiPlQohAZOxQ6m5mK/4VYJtYTt0Hr8QqylDM0BvOOqt2zog==";
    private static final String PREFS = "road-haven-content-update";
    private static final int MAX_MANIFEST_BYTES = 64 * 1024;
    private static final long MAX_DOWNLOAD_BYTES = 100L * 1024 * 1024;
    private static final Object STORAGE_LOCK = new Object();
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile String status = "idle", message = "게임 콘텐츠가 준비됐어요.", version;
    private volatile long contentVersion = 0;
    private volatile int progress = 0;

    private static final class Manifest {
        final String version, url, sha256;
        final long contentVersion, minNativeVersionCode, maxNativeVersionCode;
        final Map<String,String> files;
        final byte[] envelope;
        Manifest(String version, long contentVersion, long min, long max, String url, String sha256,
                 Map<String,String> files, byte[] envelope) {
            this.version = version; this.contentVersion = contentVersion; minNativeVersionCode = min;
            maxNativeVersionCode = max; this.url = url; this.sha256 = sha256; this.files = files; this.envelope = envelope;
        }
        boolean compatible(long nativeCode) { return nativeCode >= minNativeVersionCode && nativeCode <= maxNativeVersionCode; }
        String token() { return "v" + contentVersion + "-" + sha256.substring(0, 16); }
    }

    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private static File root(Context context) throws IOException {
        File root = new File(context.getFilesDir().getCanonicalFile(), "content-updates");
        if (!root.getCanonicalFile().equals(root.getAbsoluteFile())) throw new SecurityException("콘텐츠 보관 폴더 링크는 사용할 수 없어요.");
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("콘텐츠 보관 폴더를 만들지 못했어요.");
        return root;
    }
    private static File artifact(Context context, String token) throws IOException {
        if (token == null || !token.matches("v[1-9][0-9]{0,9}-[a-f0-9]{16}")) throw new SecurityException("잘못된 콘텐츠 보관 경로예요.");
        File directory = new File(root(context), token);
        if (!directory.getCanonicalFile().equals(directory.getAbsoluteFile())) throw new SecurityException("콘텐츠 폴더 링크는 사용할 수 없어요.");
        return directory;
    }
    private static long nativeCode(Context context) throws Exception {
        PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }
    private static String nativeVersion(Context context) throws Exception {
        return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName;
    }
    private static long integer(JSONObject object, String key) throws Exception {
        Object value = object.get(key);
        if (!(value instanceof Number)) throw new SecurityException("잘못된 콘텐츠 버전 정보예요.");
        double number = ((Number)value).doubleValue(); long exact = ((Number)value).longValue();
        if (Double.isNaN(number) || Double.isInfinite(number) || number != exact || exact < 1 || exact > 2_100_000_000L)
            throw new SecurityException("잘못된 콘텐츠 버전 정보예요.");
        return exact;
    }
    private static String string(JSONObject object, String key) throws Exception {
        Object value = object.get(key);
        if (!(value instanceof String)) throw new SecurityException("잘못된 콘텐츠 설명 정보예요.");
        return (String)value;
    }
    private static Manifest decode(byte[] envelopeBytes) throws Exception {
        if (envelopeBytes.length == 0 || envelopeBytes.length > MAX_MANIFEST_BYTES) throw new SecurityException("콘텐츠 설명 파일이 너무 커요.");
        JSONObject envelope = new JSONObject(new String(envelopeBytes, StandardCharsets.UTF_8));
        if (envelope.length() != 2) throw new SecurityException("잘못된 콘텐츠 서명 형식이에요.");
        byte[] payload = Base64.decode(string(envelope, "payload"), Base64.DEFAULT);
        byte[] signature = Base64.decode(string(envelope, "signature"), Base64.DEFAULT);
        if (payload.length == 0 || payload.length > MAX_MANIFEST_BYTES || signature.length > 256) throw new SecurityException("잘못된 콘텐츠 서명 크기예요.");
        ContentArtifactChecks.verifySignature(payload, signature, Base64.decode(PUBLIC_KEY, Base64.DEFAULT));
        // Do not parse or use even the URL until the exact payload bytes are authenticated.
        JSONObject data = new JSONObject(new String(payload, StandardCharsets.UTF_8));
        String version = string(data, "version"), sha256 = string(data, "sha256"), url = string(data, "url");
        if (version.length() > 40 || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?") || !sha256.matches("[a-f0-9]{64}"))
            throw new SecurityException("잘못된 콘텐츠 릴리스 정보예요.");
        long contentVersion = integer(data, "contentVersion"), min = integer(data, "minNativeVersionCode"), max = integer(data, "maxNativeVersionCode");
        if (min > max) throw new SecurityException("콘텐츠와 앱의 호환 범위가 올바르지 않아요.");
        ContentArtifactChecks.trustedContentUrl(url);
        JSONObject rawFiles = data.getJSONObject("files");
        Map<String,String> files = new LinkedHashMap<>();
        Iterator<String> names = rawFiles.keys();
        while (names.hasNext()) { String name = names.next(); files.put(name, string(rawFiles, name)); }
        ContentArtifactChecks.validateFileList(files);
        return new Manifest(version, contentVersion, min, max, url, sha256, files, envelopeBytes.clone());
    }
    private static byte[] readLimited(InputStream stream, int limit) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int count;
        while ((count = stream.read(buffer)) != -1) {
            if (output.size() + count > limit) throw new IOException("콘텐츠 설명 파일이 너무 커요.");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }
    private static Manifest verifiedDescriptor(Context context, String token) throws Exception {
        File directory = artifact(context, token), descriptor = new File(directory, "descriptor.json");
        if (!descriptor.getCanonicalFile().equals(descriptor.getAbsoluteFile())) throw new SecurityException("콘텐츠 설명 링크는 사용할 수 없어요.");
        Manifest manifest;
        try (InputStream stream = new FileInputStream(descriptor)) { manifest = decode(readLimited(stream, MAX_MANIFEST_BYTES)); }
        if (!manifest.token().equals(token)) throw new SecurityException("콘텐츠 버전 폴더가 일치하지 않아요.");
        return manifest;
    }
    private static Manifest verifiedArtifact(Context context, String token) throws Exception {
        Manifest manifest = verifiedDescriptor(context, token);
        File directory = artifact(context, token);
        File web = new File(directory, "web");
        if (!web.getCanonicalFile().equals(web.getAbsoluteFile())) throw new SecurityException("콘텐츠 실행 폴더 링크는 사용할 수 없어요.");
        ContentArtifactChecks.verifyFiles(web, manifest.files);
        return manifest;
    }
    private static AtomicFile rejectedFile(Context context) throws IOException {
        File file = new File(root(context), "rejected-envelope.json");
        for (String suffix : Arrays.asList("", ".bak", ".new")) {
            File candidate = new File(file.getPath() + suffix);
            if (!candidate.getCanonicalFile().equals(candidate.getAbsoluteFile())) throw new SecurityException("콘텐츠 복구 기록 링크는 사용할 수 없어요.");
        }
        return new AtomicFile(file);
    }
    private static Manifest authenticatedRejection(Context context) {
        try (InputStream input = rejectedFile(context).openRead()) { return decode(readLimited(input, MAX_MANIFEST_BYTES)); }
        catch (Exception ignored) { return null; }
    }
    private static long getRejectedVersion(Context context) {
        Manifest rejected = authenticatedRejection(context); return rejected == null ? 0 : rejected.contentVersion;
    }
    private static void rememberRejection(Context context, Manifest rejected) throws IOException {
        AtomicFile file = rejectedFile(context); FileOutputStream output = null;
        try {
            output = file.startWrite(); output.write(rejected.envelope); file.finishWrite(output); output = null;
            Manifest stored = authenticatedRejection(context);
            if (stored == null || stored.contentVersion != rejected.contentVersion || !Arrays.equals(stored.envelope, rejected.envelope))
                throw new IOException("콘텐츠 복구 기록을 저장하지 못했어요.");
        } catch (IOException error) {
            if (output != null) file.failWrite(output); throw error;
        }
    }
    private static String webPath(Context context, String token) throws IOException { return new File(artifact(context, token), "web").getCanonicalPath(); }
    private static void commit(SharedPreferences.Editor editor) throws IOException {
        if (!editor.commit()) throw new IOException("콘텐츠 업데이트 상태를 저장하지 못했어요.");
    }
    private static void delete(File file) {
        try {
            // Never follow symlinks while deleting private staging/cache directories.
            if (file.getCanonicalFile().equals(file.getAbsoluteFile()) && file.isDirectory()) {
                File[] children = file.listFiles(); if (children != null) for (File child : children) delete(child);
            }
            file.delete();
        } catch (IOException ignored) { }
    }
    private static void cleanup(Context context) {
        try {
            SharedPreferences prefs = prefs(context);
            Set<String> keep = new HashSet<>(Arrays.asList(prefs.getString("active", ""), prefs.getString("previous", ""), prefs.getString("ready", "")));
            File[] children = root(context).listFiles();
            if (children != null) for (File child : children) {
                if (!keep.contains(child.getName()) && (child.getName().matches("v[1-9][0-9]{0,9}-[a-f0-9]{16}") || child.getName().startsWith("stage-") || child.getName().startsWith("download-"))) delete(child);
            }
        } catch (Exception ignored) { }
    }
    /** Called after BridgeActivity created its default bundled server. A failed prior launch rolls back. */
    public static void restoreVerifiedContent(Activity activity, Bridge bridge) {
        if (bridge == null) return;
        synchronized (STORAGE_LOCK) {
            SharedPreferences prefs = prefs(activity);
            String active = prefs.getString("active", ""), previous = prefs.getString("previous", "");
            boolean pending = prefs.getBoolean("pendingAck", false);
            try {
                long code = nativeCode(activity);
                if (pending) {
                    Manifest rejected = authenticatedRejection(activity), failed = null;
                    // A damaged web cache may still have an authentic descriptor. A preference alone is never authority.
                    try { failed = verifiedDescriptor(activity, active); } catch (Exception ignored) { }
                    if (failed != null && (rejected == null || failed.contentVersion > rejected.contentVersion)) {
                        rememberRejection(activity, failed); rejected = failed;
                    }
                    long rejectedVersion = rejected == null ? 0 : rejected.contentVersion;
                    String recovered = ""; Manifest old = null;
                    if (!previous.isEmpty()) {
                        try { old = verifiedArtifact(activity, previous); if (old.compatible(code) && old.contentVersion > code) recovered = previous; }
                        catch (Exception ignored) { }
                    }
                    SharedPreferences.Editor editor = prefs.edit().putString("active", recovered).putLong("activeVersion", recovered.isEmpty() ? 0 : old.contentVersion)
                        .putString("previous", "").putBoolean("pendingAck", false).putLong("rejectedVersion", rejectedVersion);
                    if (prefs.getString("ready", "").equals(active)) editor.putString("ready", "");
                    commit(editor); active = recovered;
                }
                if (!active.isEmpty()) {
                    try {
                        Manifest manifest = verifiedArtifact(activity, active);
                        if (manifest.compatible(code) && manifest.contentVersion > code) {
                            commit(prefs.edit().putLong("activeVersion", manifest.contentVersion));
                            bridge.setServerBasePath(webPath(activity, active)); cleanup(activity); return;
                        }
                    } catch (Exception ignored) { }
                    // A damaged or superseded active cache can fall back to the last verified good release.
                    String recovered = ""; Manifest old = null;
                    if (!pending && !previous.isEmpty() && !previous.equals(active)) {
                        try { old = verifiedArtifact(activity, previous); if (old.compatible(code) && old.contentVersion > code) recovered = previous; }
                        catch (Exception ignored) { }
                    }
                    commit(prefs.edit().putString("active", recovered).putLong("activeVersion", recovered.isEmpty() ? 0 : old.contentVersion)
                        .putString("previous", "").putBoolean("pendingAck", false));
                    if (!recovered.isEmpty()) { bridge.setServerBasePath(webPath(activity, recovered)); cleanup(activity); return; }
                }
            } catch (Exception ignored) {
                // The bundled game stays available even when cached content cannot be validated.
            }
            try { commit(prefs.edit().putString("active", "").putLong("activeVersion", 0).putString("previous", "").putBoolean("pendingAck", false)
                .putLong("rejectedVersion", getRejectedVersion(activity))); }
            catch (Exception ignored) { }
            if (!"public".equals(bridge.getServerBasePath())) bridge.setServerAssetPath("public");
            cleanup(activity);
        }
    }
    private JSObject snapshot() {
        JSObject result = new JSObject(); result.put("status", status); result.put("progress", progress); result.put("message", message);
        if (version != null) result.put("version", version);
        if (contentVersion > 0) result.put("contentVersion", contentVersion);
        return result;
    }
    private void state(String nextStatus, int nextProgress, String nextMessage, Manifest manifest) {
        status = nextStatus; progress = Math.max(0, Math.min(100, nextProgress)); message = nextMessage;
        if (manifest != null) { version = manifest.version; contentVersion = manifest.contentVersion; }
        Activity activity = getActivity();
        if (activity != null && !activity.isFinishing()) activity.runOnUiThread(() -> notifyListeners("contentStateChanged", snapshot()));
    }
    private long currentVersion() throws Exception {
        return Math.max(nativeCode(getContext()), prefs(getContext()).getLong("activeVersion", 0));
    }
    private void idle() throws Exception {
        version = nativeVersion(getContext()); contentVersion = currentVersion();
        String active = prefs(getContext()).getString("active", "");
        if (!active.isEmpty()) {
            try { Manifest manifest = verifiedArtifact(getContext(), active); version = manifest.version; contentVersion = manifest.contentVersion; }
            catch (Exception ignored) { }
        }
        state("idle", 100, "현재 게임 콘텐츠가 최신 상태예요.", null);
    }
    private Manifest preparedContent() throws Exception {
        SharedPreferences prefs = prefs(getContext()); String token = prefs.getString("ready", "");
        if (token.isEmpty()) return null;
        Manifest manifest = verifiedArtifact(getContext(), token);
        if (!manifest.compatible(nativeCode(getContext())) || manifest.contentVersion <= currentVersion()
            || manifest.contentVersion <= getRejectedVersion(getContext())) {
            commit(prefs.edit().putString("ready", "")); return null;
        }
        return manifest;
    }
    private boolean ready() throws Exception {
        Manifest manifest = preparedContent(); if (manifest == null) return false;
        state("ready", 100, "새 게임 콘텐츠가 준비됐어요. 안전하게 돌아온 뒤 자동으로 적용해요.", manifest);
        return true;
    }
    @PluginMethod public void getState(PluginCall call) {
        worker.execute(() -> {
            try { if (!busy.get() && !ready()) idle(); call.resolve(snapshot()); }
            catch (Exception error) { state("error", 0, "저장된 게임 콘텐츠를 확인하지 못했어요. 현재 게임은 계속할 수 있어요.", null); call.resolve(snapshot()); }
        });
    }
    private HttpsURLConnection connection(URL initial, boolean manifest) throws Exception {
        URL url = initial;
        for (int redirects = 0; redirects <= 4; redirects++) {
            if (manifest) {
                if (!url.toString().equals(MANIFEST_URL)) throw new SecurityException("잘못된 콘텐츠 설명 주소예요.");
            } else ContentArtifactChecks.trustedContentUrl(url.toString());
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15_000); connection.setReadTimeout(15_000);
            connection.setRequestProperty("Cache-Control", "no-cache");
            int response;
            try { response = connection.getResponseCode(); }
            catch (Exception error) { connection.disconnect(); throw error; }
            if (response == 200) return connection;
            String location = connection.getHeaderField("Location"); connection.disconnect();
            if ((response == 301 || response == 302 || response == 303 || response == 307 || response == 308) && location != null && redirects < 4) {
                url = url.toURI().resolve(location).toURL(); continue;
            }
            throw new IOException("게임 콘텐츠 서버에 연결하지 못했어요.");
        }
        throw new IOException("콘텐츠 주소 이동이 너무 많아요.");
    }
    @PluginMethod public void check(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.resolve(snapshot()); return; }
        worker.execute(() -> {
            File archive = null, staging = null;
            Manifest prepared = null;
            String outcome = "idle", outcomeMessage = null;
            try {
                state("checking", 0, "새 게임 콘텐츠를 확인하고 있어요.", null);
                byte[] envelope; HttpsURLConnection manifestConnection = connection(new URL(MANIFEST_URL), true);
                try (InputStream input = manifestConnection.getInputStream()) { envelope = readLimited(input, MAX_MANIFEST_BYTES); }
                finally { manifestConnection.disconnect(); }
                Manifest manifest = decode(envelope); long code = nativeCode(getContext());
                if (!manifest.compatible(code)) {
                    prepared = preparedContent(); outcome = prepared == null ? "idle" : "ready";
                    outcomeMessage = prepared == null ? "이 콘텐츠는 새 APK로 앱 엔진을 업데이트한 뒤 이용할 수 있어요." : "새 게임 콘텐츠가 준비됐어요.";
                    return;
                }
                if (manifest.contentVersion <= currentVersion() || manifest.contentVersion <= getRejectedVersion(getContext())) {
                    prepared = preparedContent(); outcome = prepared == null ? "idle" : "ready"; return;
                }
                String token = manifest.token();
                try {
                    Manifest cached = verifiedArtifact(getContext(), token);
                    if (cached.contentVersion == manifest.contentVersion) {
                        commit(prefs(getContext()).edit().putString("ready", token)); prepared = cached; outcome = "ready"; return;
                    }
                } catch (Exception ignored) { }
                File base = root(getContext()); archive = new File(base, "download-" + UUID.randomUUID() + ".zip");
                state("downloading", 0, "게임 그림과 콘텐츠를 내려받고 있어요.", manifest);
                HttpsURLConnection download = connection(ContentArtifactChecks.trustedContentUrl(manifest.url), false);
                try {
                    long length = -1;
                    String contentLength = download.getHeaderField("Content-Length");
                    if (contentLength != null) try { length = Long.parseLong(contentLength); } catch (NumberFormatException ignored) { }
                    if (length > MAX_DOWNLOAD_BYTES) throw new SecurityException("콘텐츠 다운로드가 너무 커요.");
                    long total = 0; int prior = -1;
                    try (InputStream input = download.getInputStream(); OutputStream output = new FileOutputStream(archive)) {
                        byte[] buffer = new byte[65536]; int count;
                        while ((count = input.read(buffer)) != -1) {
                            if (Thread.currentThread().isInterrupted()) throw new IOException("다운로드가 중단됐어요.");
                            total += count; if (total > MAX_DOWNLOAD_BYTES) throw new SecurityException("콘텐츠 다운로드가 너무 커요.");
                            output.write(buffer, 0, count);
                            int next = length > 0 ? (int)Math.min(95, total * 95 / length) : 0;
                            if (next != prior) { state("downloading", next, "게임 콘텐츠를 내려받고 있어요.", manifest); prior = next; }
                        }
                    }
                } finally { download.disconnect(); }
                if (!ContentArtifactChecks.sha256(archive).equals(manifest.sha256)) throw new SecurityException("다운로드한 콘텐츠를 확인하지 못했어요.");
                staging = new File(base, "stage-" + UUID.randomUUID());
                if (!staging.mkdir()) throw new IOException("콘텐츠 준비 폴더를 만들지 못했어요.");
                state("downloading", 97, "받은 콘텐츠의 파일과 서명을 확인하고 있어요.", manifest);
                ContentArtifactChecks.extract(archive, new File(staging, "web"), manifest.files);
                try (FileOutputStream descriptor = new FileOutputStream(new File(staging, "descriptor.json"))) { descriptor.write(envelope); descriptor.getFD().sync(); }
                synchronized (STORAGE_LOCK) {
                    File destination = artifact(getContext(), token);
                    if (destination.exists()) delete(destination);
                    if (!staging.renameTo(destination)) throw new IOException("콘텐츠를 저장하지 못했어요.");
                    staging = null; verifiedArtifact(getContext(), token);
                    commit(prefs(getContext()).edit().putString("ready", token));
                }
                prepared = manifest; outcome = "ready";
            } catch (Exception error) {
                outcome = "error";
            } finally {
                if (archive != null) delete(archive); if (staging != null) delete(staging);
                cleanup(getContext()); busy.set(false);
                // Ready events may trigger activate immediately. Release the worker gate first.
                if ("ready".equals(outcome)) state("ready", 100, outcomeMessage == null ? "새 게임 콘텐츠가 준비됐어요. 진행 상황을 저장한 뒤 자동으로 적용해요." : outcomeMessage, prepared);
                else if ("error".equals(outcome)) state("error", 0, "콘텐츠 업데이트를 받지 못했어요. 현재 게임은 계속할 수 있어요.", null);
                else {
                    try { idle(); if (outcomeMessage != null) message = outcomeMessage; }
                    catch (Exception ignored) { state("error", 0, "현재 게임 콘텐츠 상태를 확인하지 못했어요.", null); }
                }
                call.resolve(snapshot());
            }
        });
    }
    @PluginMethod public void activate(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("콘텐츠 확인을 마친 뒤 적용할 수 있어요."); return; }
        worker.execute(() -> {
            try {
                final String token = prefs(getContext()).getString("ready", "");
                final Manifest manifest = verifiedArtifact(getContext(), token);
                if (!manifest.compatible(nativeCode(getContext())) || manifest.contentVersion <= currentVersion()
                    || manifest.contentVersion <= getRejectedVersion(getContext())) throw new SecurityException("적용할 새 콘텐츠가 없어요.");
                final String path = webPath(getContext(), token);
                getActivity().runOnUiThread(() -> {
                    try {
                        synchronized (STORAGE_LOCK) {
                            SharedPreferences prefs = prefs(getContext());
                            commit(prefs.edit().putString("previous", prefs.getString("active", "")).putString("active", token)
                                .putLong("activeVersion", manifest.contentVersion).putBoolean("pendingAck", true).putString("ready", ""));
                            state("idle", 100, "새 게임 콘텐츠를 적용하고 있어요.", manifest);
                            call.resolve(snapshot()); getBridge().setServerBasePath(path);
                        }
                    } catch (Exception error) { call.reject("게임 콘텐츠를 적용하지 못했어요.", error); }
                    finally { busy.set(false); }
                });
            } catch (Exception error) { busy.set(false); call.reject("안전하게 적용할 콘텐츠를 확인하지 못했어요.", error); }
        });
    }
    @PluginMethod public void acknowledge(PluginCall call) {
        worker.execute(() -> {
            try {
                synchronized (STORAGE_LOCK) {
                    SharedPreferences prefs = prefs(getContext()); String active = prefs.getString("active", "");
                    if (active.isEmpty()) { call.resolve(snapshot()); return; }
                    Manifest manifest = verifiedArtifact(getContext(), active);
                    if (!manifest.compatible(nativeCode(getContext())) || !webPath(getContext(), active).equals(getBridge().getServerBasePath()))
                        throw new SecurityException("현재 실행 중인 콘텐츠를 확인하지 못했어요.");
                    commit(prefs.edit().putBoolean("pendingAck", false).putLong("activeVersion", manifest.contentVersion));
                    state("idle", 100, "게임 콘텐츠 업데이트를 완료했어요.", manifest); cleanup(getContext()); call.resolve(snapshot());
                }
            } catch (Exception error) { call.reject("새 콘텐츠 실행을 확인하지 못했어요.", error); }
        });
    }
    @Override protected void handleOnDestroy() { worker.shutdownNow(); }
}
