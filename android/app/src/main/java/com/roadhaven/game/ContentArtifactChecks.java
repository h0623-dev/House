package com.roadhaven.game;

import java.io.*;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.net.URI;
import java.net.URL;
import java.util.*;
import java.util.zip.*;

/** Pure Java checks shared by the native content updater and local tests. */
public final class ContentArtifactChecks {
    private ContentArtifactChecks() {}
    public static final long MAX_EXPANDED_BYTES = 200L * 1024 * 1024;
    public static void verifySignature(byte[] payload, byte[] signature, byte[] publicKey) throws Exception {
        PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(publicKey));
        Signature verifier = Signature.getInstance("SHA256withECDSA");
        verifier.initVerify(key); verifier.update(payload);
        if (!verifier.verify(signature)) throw new SecurityException("콘텐츠 서명을 확인하지 못했어요.");
    }
    public static String safePath(String name) {
        if (name == null || name.length() > 200 || !name.matches("[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*")
            || name.equals(".") || name.equals("..") || name.startsWith(".")
            || name.contains("/../") || name.contains("/./") || name.endsWith("/..") || name.endsWith("/."))
            throw new SecurityException("안전하지 않은 콘텐츠 경로예요.");
        if (!(name.equals("index.html") || name.startsWith("assets/") || name.startsWith("fonts/")))
            throw new SecurityException("허용되지 않은 콘텐츠 파일이에요.");
        return name;
    }
    public static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] bytes = new byte[65536]; int count;
            while ((count = in.read(bytes)) != -1) digest.update(bytes, 0, count);
        }
        StringBuilder hex = new StringBuilder();
        for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value & 255));
        return hex.toString();
    }
    public static URL trustedContentUrl(String value) throws Exception {
        URI uri = new URI(value);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !"raw.githubusercontent.com".equalsIgnoreCase(uri.getHost())
            || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getRawUserInfo() != null
            || uri.getRawQuery() != null || uri.getRawFragment() != null
            || !uri.getRawPath().matches("/h0623-dev/House/gh-pages/content/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\\.zip"))
            throw new SecurityException("허용되지 않은 콘텐츠 다운로드 주소예요.");
        return uri.toURL();
    }
    public static void validateFileList(Map<String,String> files) {
        if (files == null || !files.containsKey("index.html") || files.isEmpty() || files.size() > 200)
            throw new SecurityException("실행 파일이 없는 콘텐츠예요.");
        for (Map.Entry<String,String> entry : files.entrySet()) {
            safePath(entry.getKey());
            if (entry.getValue() == null || !entry.getValue().matches("[a-f0-9]{64}"))
                throw new SecurityException("올바르지 않은 콘텐츠 해시예요.");
        }
    }
    private static void actualFiles(File directory, String prefix, Set<String> found, int[] directories) throws Exception {
        if (!directory.getCanonicalFile().equals(directory.getAbsoluteFile()) || ++directories[0] > 400)
            throw new SecurityException("올바르지 않은 콘텐츠 폴더예요.");
        File[] children = directory.listFiles();
        if (children == null) throw new IOException("콘텐츠 폴더를 읽지 못했어요.");
        for (File child : children) {
            if (!child.getCanonicalFile().equals(child.getAbsoluteFile())) throw new SecurityException("콘텐츠 링크는 사용할 수 없어요.");
            String path = prefix + child.getName();
            if (child.isDirectory()) actualFiles(child, path + "/", found, directories);
            else if (!child.isFile() || !found.add(safePath(path)) || found.size() > 200)
                throw new SecurityException("올바르지 않은 콘텐츠 파일이에요.");
        }
    }
    public static void verifyFiles(File directory, Map<String,String> files) throws Exception {
        validateFileList(files);
        if (!directory.getCanonicalFile().equals(directory.getAbsoluteFile())) throw new SecurityException("콘텐츠 실행 폴더 링크는 사용할 수 없어요.");
        Set<String> actual = new HashSet<>();
        actualFiles(directory.getCanonicalFile(), "", actual, new int[]{0});
        if (!actual.equals(files.keySet())) throw new SecurityException("서명된 목록과 콘텐츠 파일이 달라요.");
        String base = directory.getCanonicalPath() + File.separator;
        long total = 0;
        for (Map.Entry<String,String> entry : files.entrySet()) {
            File file = new File(directory, safePath(entry.getKey()));
            if (!file.getCanonicalPath().startsWith(base) || !file.isFile()) throw new SecurityException("콘텐츠 파일이 누락됐어요.");
            total += file.length();
            if (total > MAX_EXPANDED_BYTES || !entry.getValue().matches("[a-f0-9]{64}") || !sha256(file).equals(entry.getValue()))
                throw new SecurityException("콘텐츠 파일 검증에 실패했어요.");
        }
    }
    public static void extract(File archive, File directory, Map<String,String> files) throws Exception {
        validateFileList(files);
        if (directory.exists() || !directory.mkdirs()) throw new IOException("새 콘텐츠 폴더를 만들지 못했어요.");
        String base = directory.getCanonicalPath() + File.separator;
        Set<String> seen = new HashSet<>(); long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new FileInputStream(archive))) {
            ZipEntry entry; byte[] buffer = new byte[65536];
            while ((entry = zip.getNextEntry()) != null) {
                String name = safePath(entry.getName());
                if (entry.isDirectory() || !files.containsKey(name) || !seen.add(name) || seen.size() > 200)
                    throw new SecurityException("콘텐츠 압축 목록이 올바르지 않아요.");
                File file = new File(directory, name);
                if (!file.getCanonicalPath().startsWith(base)) throw new SecurityException("잘못된 압축 경로예요.");
                File parent = file.getParentFile();
                if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("콘텐츠 폴더를 만들지 못했어요.");
                try (OutputStream out = new FileOutputStream(file)) {
                    int count;
                    while ((count = zip.read(buffer)) != -1) {
                        total += count;
                        if (total > MAX_EXPANDED_BYTES) throw new SecurityException("콘텐츠 압축이 너무 커요.");
                        out.write(buffer, 0, count);
                    }
                }
                zip.closeEntry();
            }
        }
        if (!seen.equals(files.keySet())) throw new SecurityException("콘텐츠 목록과 압축 파일이 달라요.");
        verifyFiles(directory, files);
    }
}
