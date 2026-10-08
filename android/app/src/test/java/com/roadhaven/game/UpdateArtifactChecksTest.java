package com.roadhaven.game;

import static org.junit.Assert.*;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.junit.Test;

public class UpdateArtifactChecksTest {
    private static final Set<String> SIGNER = Collections.singleton("same-valid-certificate-digest");

    @Test public void redirectsRequireHttpsWithoutCredentialsOrFragments() throws Exception {
        assertEquals("https://raw.githubusercontent.com/repo/game.apk?download=1", UpdateArtifactChecks.validateHttpsUrl("https://raw.githubusercontent.com/repo/game.apk?download=1").toString());
        for (String input : new String[]{"http://example.com/game.apk", "file:///tmp/game.apk", "//example.com/game.apk", "game.apk", "https:///game.apk", "https://user:pass@example.com/game.apk", "https://@example.com/game.apk", "https://example.com/game.apk#fragment", "https://example.com/game.apk#"}) {
            assertThrows(input, Exception.class, () -> UpdateArtifactChecks.validateHttpsUrl(input));
        }
    }

    @Test public void sha256ChecksTheCompleteFileAndAcceptsUppercaseManifestHex() throws Exception {
        File file = File.createTempFile("update-valid", ".apk");
        try {
            byte[] content = "actual downloaded APK fixture bytes".getBytes(StandardCharsets.UTF_8);
            Files.write(file.toPath(), content);
            String hash = UpdateArtifactChecks.hex(UpdateArtifactChecks.sha256().digest(content));
            UpdateArtifactChecks.verifySha256(file, hash.toUpperCase(), 1024);
            Files.write(file.toPath(), "tampered".getBytes(StandardCharsets.UTF_8));
            assertThrows(IOException.class, () -> UpdateArtifactChecks.verifySha256(file, hash, 1024));
        } finally { file.delete(); }
    }

    @Test public void emptyOversizedMissingOrMalformedFilesNeverBecomeInstallable() throws Exception {
        File file = File.createTempFile("update-invalid", ".apk");
        try {
            String hash = "a".repeat(64);
            assertThrows(IOException.class, () -> UpdateArtifactChecks.verifySha256(file, hash, 1024));
            Files.write(file.toPath(), new byte[8]);
            assertThrows(IOException.class, () -> UpdateArtifactChecks.verifySha256(file, hash, 4));
            assertThrows(IllegalArgumentException.class, () -> UpdateArtifactChecks.verifySha256(file, "not-a-checksum", 1024));
            file.delete();
            assertThrows(IOException.class, () -> UpdateArtifactChecks.verifySha256(file, hash, 1024));
        } finally { file.delete(); }
    }

    @Test public void identityRequiresExactPackageAndSignerAndIncreasingManifestVersion() {
        verify("com.roadhaven.game", 9, SIGNER, 9, "0.9.0");
        assertThrows(IllegalArgumentException.class, () -> verify("com.other.app", 9, SIGNER, 9, "0.9.0"));
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 9, Collections.singleton("other-key"), 9, "0.9.0"));
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 9, Collections.emptySet(), 9, "0.9.0"));
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 8, SIGNER, 8, "0.9.0"));
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 7, SIGNER, 7, "0.9.0"));
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 9, SIGNER, 10, "0.9.0"));
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 9, SIGNER, 9, "0.8.0"));
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 2100000001L, SIGNER, 2100000001L, "0.9.0"));
    }

    @Test public void extraSignerCannotMasqueradeAsTheInstalledSigningIdentity() {
        Set<String> extra = new HashSet<>(SIGNER); extra.add("injected-certificate");
        assertThrows(IllegalArgumentException.class, () -> verify("com.roadhaven.game", 9, extra, 9, "0.9.0"));
        assertThrows(IllegalArgumentException.class, () -> UpdateArtifactChecks.verifyIdentity("com.roadhaven.game", 8, Collections.emptySet(), "com.roadhaven.game", 9, SIGNER, 9, "0.9.0", "0.9.0"));
    }

    private void verify(String pkg, long code, Set<String> signers, long expectedCode, String candidateVersion) {
        UpdateArtifactChecks.verifyIdentity("com.roadhaven.game", 8, SIGNER, pkg, code, signers, expectedCode, "0.9.0", candidateVersion);
    }
}
