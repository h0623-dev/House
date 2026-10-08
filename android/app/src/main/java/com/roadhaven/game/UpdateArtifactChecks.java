package com.roadhaven.game;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.Set;

/** Platform-independent checks shared by download and cached-file installation. */
public final class UpdateArtifactChecks {
    public static final long MAX_APK_BYTES = 200L * 1024 * 1024;
    private UpdateArtifactChecks() {}

    public static URL validateHttpsUrl(String value) throws Exception {
        if (value == null || value.length() > 8192) throw new IllegalArgumentException("Invalid update URL");
        URI uri = new URI(value);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getHost().isEmpty()
                || uri.getRawUserInfo() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("Updates require an HTTPS URL without credentials or fragments");
        }
        return uri.toURL();
    }

    public static String normalizeSha256(String value) {
        if (value == null || !value.matches("[a-fA-F0-9]{64}")) throw new IllegalArgumentException("Invalid SHA-256 checksum");
        return value.toLowerCase(Locale.ROOT);
    }

    public static void verifySha256(File file, String expected, long maxBytes) throws IOException {
        String checksum = normalizeSha256(expected);
        if (maxBytes <= 0 || !file.isFile() || file.length() == 0 || file.length() > maxBytes) throw new IOException("Update file size is invalid");
        MessageDigest digest = sha256();
        long bytes = 0;
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[64 * 1024]; int count;
            while ((count = input.read(buffer)) != -1) {
                bytes += count;
                if (bytes > maxBytes) throw new IOException("Update file exceeds the size limit");
                digest.update(buffer, 0, count);
            }
        }
        if (!MessageDigest.isEqual(hex(digest.digest()).getBytes(StandardCharsets.US_ASCII), checksum.getBytes(StandardCharsets.US_ASCII))) {
            throw new IOException("Update checksum does not match");
        }
    }

    public static void verifyIdentity(String installedPackage, long installedCode, Set<String> installedSigners,
            String candidatePackage, long candidateCode, Set<String> candidateSigners,
            long expectedCode, String expectedVersion, String candidateVersion) {
        if (installedPackage == null || !installedPackage.equals(candidatePackage)) throw new IllegalArgumentException("Update package does not match the installed app");
        if (installedSigners == null || installedSigners.isEmpty() || candidateSigners == null || !installedSigners.equals(candidateSigners)) {
            throw new IllegalArgumentException("Update signing certificates do not match the installed app");
        }
        if (expectedCode < 1 || expectedCode > 2100000000L || candidateCode != expectedCode || candidateCode <= installedCode) {
            throw new IllegalArgumentException("Update version code must match the manifest and increase");
        }
        if (expectedVersion == null || !expectedVersion.equals(candidateVersion)) throw new IllegalArgumentException("Update version name does not match the manifest");
    }

    public static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    public static String hex(byte[] bytes) {
        StringBuilder text = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) text.append(String.format(Locale.ROOT, "%02x", item & 0xff));
        return text.toString();
    }
}
