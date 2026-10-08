package com.roadhaven.game;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.*;
import java.util.zip.*;
import static org.junit.Assert.*;

public class ContentArtifactChecksTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();
    private interface Checked { void run() throws Exception; }
    private void rejected(Checked work) throws Exception {
        try { work.run(); fail("Untrusted content was accepted"); }
        catch (SecurityException | IOException | GeneralSecurityException expected) { }
    }
    private KeyPair key() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1")); return generator.generateKeyPair();
    }
    private byte[] sign(byte[] payload, KeyPair key) throws Exception {
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(key.getPrivate()); signer.update(payload); return signer.sign();
    }
    private File write(File directory, String name, byte[] bytes) throws Exception {
        File file = new File(directory, name);
        if (!file.getParentFile().isDirectory()) assertTrue(file.getParentFile().mkdirs());
        try (OutputStream output = new FileOutputStream(file)) { output.write(bytes); }
        return file;
    }
    private Map<String,String> list(File directory, String... names) throws Exception {
        Map<String,String> files = new LinkedHashMap<>();
        for (String name : names) files.put(name, ContentArtifactChecks.sha256(new File(directory, name)));
        return files;
    }
    private File zip(Map<String,byte[]> entries) throws Exception {
        File archive = temporary.newFile();
        try (ZipOutputStream output = new ZipOutputStream(new FileOutputStream(archive))) {
            for (Map.Entry<String,byte[]> entry : entries.entrySet()) {
                output.putNextEntry(new ZipEntry(entry.getKey())); output.write(entry.getValue()); output.closeEntry();
            }
        }
        return archive;
    }
    private File absent(String name) { return new File(temporary.getRoot(), name); }
    private byte[] bytes(String value) { return value.getBytes(StandardCharsets.UTF_8); }

    @Test public void validEcdsaAuthenticatesExactRawUtf8BytesAndRoundTripsBase64() throws Exception {
        KeyPair key = key();
        byte[] payload = bytes("{\"version\":\"0.8.1\",\"message\":\"새 게임 콘텐츠\",\"contentVersion\":9}");
        byte[] signature = sign(payload, key);
        byte[] decoded = Base64.getDecoder().decode(Base64.getEncoder().encodeToString(payload));
        assertArrayEquals(payload, decoded);
        ContentArtifactChecks.verifySignature(decoded, signature, key.getPublic().getEncoded());
    }
    @Test public void payloadOrSignatureTamperingAndWrongPinnedKeyAreRejected() throws Exception {
        KeyPair trusted = key(); byte[] payload = bytes("{\"url\":\"https://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/game.zip\"}");
        byte[] signature = sign(payload, trusted);
        byte[] tampered = payload.clone(); tampered[8] ^= 1;
        rejected(() -> ContentArtifactChecks.verifySignature(tampered, signature, trusted.getPublic().getEncoded()));
        byte[] broken = signature.clone(); broken[broken.length - 1] ^= 1;
        rejected(() -> ContentArtifactChecks.verifySignature(payload, broken, trusted.getPublic().getEncoded()));
        rejected(() -> ContentArtifactChecks.verifySignature(payload, signature, key().getPublic().getEncoded()));
    }
    @Test public void unsignedVersionSubstitutionCannotBecomeRollbackQuarantineAuthority() throws Exception {
        KeyPair trusted = key();
        byte[] verifiedRelease = bytes("{\"contentVersion\":9,\"version\":\"0.8.1\"}");
        byte[] signature = sign(verifiedRelease, trusted);
        ContentArtifactChecks.verifySignature(verifiedRelease, signature, trusted.getPublic().getEncoded());
        byte[] substituted = bytes("{\"contentVersion\":999,\"version\":\"0.8.1\"}");
        rejected(() -> ContentArtifactChecks.verifySignature(substituted, signature, trusted.getPublic().getEncoded()));
    }
    @Test public void contentUrlStaysOnHttpsTheExactRepositoryAndContentDirectory() throws Exception {
        assertEquals("raw.githubusercontent.com", ContentArtifactChecks.trustedContentUrl("https://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/road-haven-0.8.1-content.zip").getHost());
        ContentArtifactChecks.trustedContentUrl("https://raw.githubusercontent.com:443/h0623-dev/House/gh-pages/content/game.zip");
        for (String value : Arrays.asList(
            "http://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/game.zip",
            "https://evil.example/h0623-dev/House/gh-pages/content/game.zip",
            "https://user@raw.githubusercontent.com/h0623-dev/House/gh-pages/content/game.zip",
            "https://raw.githubusercontent.com:444/h0623-dev/House/gh-pages/content/game.zip",
            "https://raw.githubusercontent.com/h0623-dev/Other/gh-pages/content/game.zip",
            "https://raw.githubusercontent.com/h0623-dev/House/main/content/game.zip",
            "https://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/../game.zip",
            "https://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/%2e%2e/game.zip",
            "https://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/game.zip?token=1",
            "https://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/game.zip#fragment")) rejected(() -> ContentArtifactChecks.trustedContentUrl(value));
    }
    @Test public void traversalAbsoluteWindowsAndUnservedFilePathsAreRejected() throws Exception {
        for (String path : Arrays.asList("../index.html", "/index.html", "assets/../../outside", "assets/a/../b.js", "assets/./b.js", "assets/a/..", "assets//b.js", "assets\\b.js", "C:/index.html", "descriptor.json", ".nojekyll", "index.html/extra"))
            rejected(() -> ContentArtifactChecks.safePath(path));
        assertEquals("assets/game-A12.js", ContentArtifactChecks.safePath("assets/game-A12.js"));
        assertEquals("fonts/NotoSansKR.woff2", ContentArtifactChecks.safePath("fonts/NotoSansKR.woff2"));
    }
    @Test public void validArchiveExtractsExactlySignedFilesAndCanBeReverified() throws Exception {
        File source = temporary.newFolder();
        write(source, "index.html", bytes("<script src='./assets/main.js'></script>"));
        write(source, "assets/main.js", bytes("window.gameReady=true;"));
        Map<String,String> files = list(source, "index.html", "assets/main.js");
        Map<String,byte[]> entries = new LinkedHashMap<>();
        entries.put("index.html", Files.readAllBytes(new File(source, "index.html").toPath()));
        entries.put("assets/main.js", Files.readAllBytes(new File(source, "assets/main.js").toPath()));
        File destination = absent("valid-web");
        ContentArtifactChecks.extract(zip(entries), destination, files);
        ContentArtifactChecks.verifyFiles(destination, files);
        assertEquals(files.get("assets/main.js"), ContentArtifactChecks.sha256(new File(destination, "assets/main.js")));
    }
    @Test public void zipTraversalNeverWritesOutsidePrivateDestination() throws Exception {
        File source = temporary.newFolder(); write(source, "index.html", bytes("valid"));
        Map<String,String> files = list(source, "index.html");
        Map<String,byte[]> entries = new LinkedHashMap<>(); entries.put("../outside.txt", bytes("attack"));
        rejected(() -> ContentArtifactChecks.extract(zip(entries), absent("traversal-web"), files));
        assertFalse(absent("outside.txt").exists());
    }
    @Test public void unlistedOrMissingFilesAndDirectoryEntriesAreRejected() throws Exception {
        File source = temporary.newFolder(); write(source, "index.html", bytes("valid")); write(source, "assets/main.js", bytes("game"));
        Map<String,String> one = list(source, "index.html"), both = list(source, "index.html", "assets/main.js");
        Map<String,byte[]> extra = new LinkedHashMap<>(); extra.put("index.html", bytes("valid")); extra.put("assets/extra.js", bytes("extra"));
        rejected(() -> ContentArtifactChecks.extract(zip(extra), absent("extra-web"), one));
        rejected(() -> ContentArtifactChecks.extract(zip(Collections.singletonMap("index.html", bytes("valid"))), absent("missing-web"), both));
        Map<String,byte[]> directory = new LinkedHashMap<>(); directory.put("assets/", new byte[0]); directory.put("index.html", bytes("valid"));
        rejected(() -> ContentArtifactChecks.extract(zip(directory), absent("directory-web"), one));
    }
    @Test public void duplicateZipEntriesCannotOverwriteAuthenticatedFiles() throws Exception {
        File source = temporary.newFolder(); write(source, "index.html", bytes("valid"));
        File first = zip(Collections.singletonMap("index.html", bytes("valid")));
        byte[] archive = Files.readAllBytes(first.toPath()); int central = -1;
        for (int i = 0; i < archive.length - 3; i++) if (archive[i] == 0x50 && archive[i+1] == 0x4b && archive[i+2] == 1 && archive[i+3] == 2) { central = i; break; }
        assertTrue(central > 0);
        File duplicate = temporary.newFile();
        try (OutputStream output = new FileOutputStream(duplicate)) { output.write(archive, 0, central); output.write(archive); }
        rejected(() -> ContentArtifactChecks.extract(duplicate, absent("duplicate-web"), list(source, "index.html")));
    }
    @Test public void wrongFileHashesAndFilesTamperedAfterExtractionAreRejected() throws Exception {
        File source = temporary.newFolder(); write(source, "index.html", bytes("valid"));
        Map<String,String> files = list(source, "index.html");
        rejected(() -> ContentArtifactChecks.extract(zip(Collections.singletonMap("index.html", bytes("changed"))), absent("hash-web"), files));
        write(source, "index.html", bytes("changed"));
        rejected(() -> ContentArtifactChecks.verifyFiles(source, files));
    }
    @Test public void diskReverificationRejectsAdditionalUnlistedFiles() throws Exception {
        File source = temporary.newFolder(); write(source, "index.html", bytes("valid"));
        Map<String,String> files = list(source, "index.html");
        write(source, "assets/unlisted.js", bytes("extra"));
        rejected(() -> ContentArtifactChecks.verifyFiles(source, files));
    }
    @Test public void diskReverificationRejectsSymlinksToFilesAndTheRoot() throws Exception {
        File source = temporary.newFolder(), outside = temporary.newFolder();
        write(source, "index.html", bytes("valid")); write(outside, "outside.js", bytes("game"));
        File assets = new File(source, "assets"); assertTrue(assets.mkdir());
        Files.createSymbolicLink(new File(assets, "main.js").toPath(), new File(outside, "outside.js").toPath());
        Map<String,String> files = list(source, "index.html", "assets/main.js");
        rejected(() -> ContentArtifactChecks.verifyFiles(source, files));
        File clean = temporary.newFolder(); write(clean, "index.html", bytes("valid"));
        File link = absent("root-link"); Files.createSymbolicLink(link.toPath(), clean.toPath());
        rejected(() -> ContentArtifactChecks.verifyFiles(link, list(clean, "index.html")));
    }
    @Test public void malformedHashesMissingIndexAndExcessiveFileMapsFailBeforeExtraction() throws Exception {
        Map<String,String> empty = new LinkedHashMap<>(); rejected(() -> ContentArtifactChecks.validateFileList(empty));
        Map<String,String> wrong = new LinkedHashMap<>(); wrong.put("index.html", "not-a-hash");
        rejected(() -> ContentArtifactChecks.validateFileList(wrong));
        wrong.put("index.html", null); rejected(() -> ContentArtifactChecks.validateFileList(wrong));
        Map<String,String> many = new LinkedHashMap<>(); many.put("index.html", String.join("", Collections.nCopies(64, "a")));
        for (int i = 0; i < 200; i++) many.put("assets/" + i + ".js", many.get("index.html"));
        rejected(() -> ContentArtifactChecks.validateFileList(many));
    }
    @Test public void compressedBombCannotExpandPastTwoHundredMiB() throws Exception {
        File archive = temporary.newFile();
        byte[] zeros = new byte[1024 * 1024];
        try (ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(archive))) {
            zip.putNextEntry(new ZipEntry("index.html"));
            for (int i = 0; i < 201; i++) zip.write(zeros);
            zip.closeEntry();
        }
        assertTrue(archive.length() < 1024 * 1024);
        Map<String,String> files = Collections.singletonMap("index.html", String.join("", Collections.nCopies(64, "a")));
        File web = absent("bomb-web");
        rejected(() -> ContentArtifactChecks.extract(archive, web, files));
        assertTrue(new File(web, "index.html").length() <= ContentArtifactChecks.MAX_EXPANDED_BYTES);
    }
}
