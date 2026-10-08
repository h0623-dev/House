#!/usr/bin/env bash
# Installs verified developer tools into /workspace and accepts Android SDK licenses.
set -euo pipefail
export ANDROID_HOME="${ANDROID_HOME:-/workspace/android-sdk}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-/workspace/.android}"
export ANDROID_SDK_HOME="${ANDROID_SDK_HOME:-/workspace}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/.gradle}"
mkdir -p "$ANDROID_HOME" "$ANDROID_USER_HOME/cache" "$GRADLE_USER_HOME"
work_dir="$(mktemp -d /tmp/road-haven-tools.XXXXXX)"
trap 'rm -rf "$work_dir"' EXIT

if [[ -n "${JAVA_HOME:-}" && ! -x "$JAVA_HOME/bin/javac" ]]; then
  unset JAVA_HOME
fi
if [[ ! -x "${JAVA_HOME:-/workspace/java/current}/bin/javac" ]]; then
  mkdir -p /workspace/java
  curl --fail --location --silent --show-error \
    https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz.sha256 -o "$work_dir/jdk.sha256"
  curl --fail --location --silent --show-error \
    https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz -o "$work_dir/jdk.tar.gz"
  python3 - "$work_dir" <<'PY'
import hashlib, pathlib, sys, tarfile
temp = pathlib.Path(sys.argv[1])
archive = temp / 'jdk.tar.gz'
expected = (temp / 'jdk.sha256').read_text().split()[0]
if hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() != expected:
    raise SystemExit('Official JDK SHA-256 verification failed')
with tarfile.open(archive) as bundle:
    root = bundle.getmembers()[0].name.split('/')[0]
    bundle.extractall('/workspace/java', filter='data')
target = pathlib.Path('/workspace/java/current')
if target.is_symlink(): target.unlink()
target.symlink_to(pathlib.Path('/workspace/java') / root)
PY
fi
export JAVA_HOME="${JAVA_HOME:-/workspace/java/current}"
export PATH="$JAVA_HOME/bin:$PATH"
# Retain the managed environment's existing public CA and proxy CA trust.
if [[ "$JAVA_HOME" == /workspace/java/* && -f /etc/ssl/certs/java/cacerts ]]; then
  cp /etc/ssl/certs/java/cacerts "$JAVA_HOME/lib/security/cacerts"
fi

if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  curl --fail --location --silent --show-error \
    https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip -o "$work_dir/tools.zip"
  # This pinned artifact was checked against Google's repository manifest.
  python3 - "$work_dir/tools.zip" "$ANDROID_HOME" <<'PY'
import hashlib, pathlib, sys, zipfile
archive = pathlib.Path(sys.argv[1])
if hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() != '7ec965280a073311c339e571cd5de778b9975026cfcbe79f2b1cdcb1e15317ee':
    raise SystemExit('Android command-line tools SHA-256 verification failed')
root = pathlib.Path(sys.argv[2]) / 'cmdline-tools'
root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as bundle: bundle.extractall(root)
(root / 'cmdline-tools').rename(root / 'latest')
for executable in (root / 'latest' / 'bin').iterdir(): executable.chmod(0o755)
PY
fi

proxy_args=()
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  mapfile -t proxy < <(python3 - <<'PY'
import os, urllib.parse
p = urllib.parse.urlparse(os.environ['HTTPS_PROXY'])
print(p.hostname or '')
print(p.port or 80)
PY
)
  proxy_args=(--proxy=http "--proxy_host=${proxy[0]}" "--proxy_port=${proxy[1]}")
  # Only the proxy host and port are written. Existing settings remain intact.
  python3 - "$GRADLE_USER_HOME/gradle.properties" "${proxy[@]}" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
old = path.read_text() if path.exists() else ''
settings = {f'systemProp.{scheme}.proxy{part}': value
            for scheme in ('http', 'https')
            for part, value in [('Host', sys.argv[2]), ('Port', sys.argv[3])]}
existing = {line.split('=', 1)[0].strip() for line in old.splitlines() if '=' in line}
with path.open('a') as output:
    if old and not old.endswith('\n'): output.write('\n')
    for key, value in settings.items():
        if key not in existing: output.write(f'{key}={value}\n')
PY
fi
sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
set +o pipefail
yes 2>/dev/null | "$sdkmanager" --sdk_root="$ANDROID_HOME" "${proxy_args[@]}" --licenses >/dev/null
license_status="${PIPESTATUS[1]}"
set -o pipefail
if [[ "$license_status" != 0 ]]; then exit "$license_status"; fi
"$sdkmanager" --sdk_root="$ANDROID_HOME" "${proxy_args[@]}" \
  'platforms;android-35' 'build-tools;34.0.0' 'build-tools;35.0.0' 'platform-tools'
echo 'Android development tools are ready. Run bash scripts/build-android.sh debug.'
