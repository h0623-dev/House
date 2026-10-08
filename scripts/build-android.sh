#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
variant="${1:-debug}"
if [[ "$variant" != debug && "$variant" != release ]]; then
  echo 'Usage: bash scripts/build-android.sh [debug|release]' >&2
  exit 1
fi

if [[ -z "${JAVA_HOME:-}" && -x /workspace/java/current/bin/javac ]]; then
  export JAVA_HOME=/workspace/java/current
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if ! command -v javac >/dev/null 2>&1; then
  echo 'A complete JDK 21 (including javac) is required; a Java runtime alone is insufficient.' >&2
  exit 1
fi
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/workspace/android-sdk}}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-$repo_dir/../.android}"
export ANDROID_SDK_HOME="${ANDROID_SDK_HOME:-$repo_dir/..}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$repo_dir/../.gradle}"
export APP_VERSION_CODE="${APP_VERSION_CODE:-$(node -p "JSON.parse(require('fs').readFileSync('release-version.json','utf8')).versionCode")}"
export VITE_APP_VERSION_CODE="$APP_VERSION_CODE"
export VITE_APP_VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")"
export VITE_UPDATE_MANIFEST_URL="${VITE_UPDATE_MANIFEST_URL:-https://raw.githubusercontent.com/h0623-dev/House/gh-pages/update.json}"

node --input-type=module -e '
  const raw = process.env.APP_VERSION_CODE;
  const code = Number(raw);
  if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(code) || code > 2100000000) {
    console.error("APP_VERSION_CODE must be an integer from 1 to 2100000000.");
    process.exit(1);
  }
'
if [[ ! -f "$ANDROID_HOME/platforms/android-35/android.jar" ]]; then
  echo 'Install Android SDK platform 35 and build-tools 35.0.0; see docs/ANDROID.md.' >&2
  exit 1
fi

if [[ "$variant" == release ]]; then
  for required in ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
    if [[ -z "${!required:-}" ]]; then
      echo "Missing release signing configuration: $required" >&2
      exit 1
    fi
  done
  task=assembleRelease
else
  # Keep this test signing identity outside the repository and reuse it for test updates.
  export ANDROID_DEBUG_KEYSTORE="${ANDROID_DEBUG_KEYSTORE:-$repo_dir/../.road-haven-signing/debug.keystore}"
  if [[ ! -f "$ANDROID_DEBUG_KEYSTORE" ]]; then
    if compgen -G 'artifacts/road-haven-*-debug.apk' >/dev/null; then
      echo 'Restore the original debug signing key before updating an existing test APK; generating another key would break in-place updates.' >&2
      exit 1
    fi
    mkdir -p "$(dirname "$ANDROID_DEBUG_KEYSTORE")"
    keytool -genkeypair -keystore "$ANDROID_DEBUG_KEYSTORE" -storepass android \
      -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
      -dname 'CN=Android Debug,O=Road Haven Development,C=KR' -noprompt
    chmod 600 "$ANDROID_DEBUG_KEYSTORE"
  fi
  task=assembleDebug
fi

npm run build
npx --no-install cap sync android
(cd android && ./gradlew "$task" --no-daemon --max-workers=4 --console=plain)

mkdir -p artifacts
apk_path="artifacts/road-haven-$VITE_APP_VERSION-$variant.apk"
apk_build="android/app/build/outputs/apk/$variant/app-$variant.apk"
if [[ -n "${PREVIOUS_APK_PATH:-}" ]]; then
  node scripts/verify-android-update.mjs "$PREVIOUS_APK_PATH" "$apk_build"
fi
cp "$apk_build" "$apk_path"
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose "$apk_path"
sha256sum "$apk_path" > "$apk_path.sha256"
if [[ -n "${APK_PUBLIC_URL:-}" ]]; then
  node scripts/create-update-manifest.mjs "$apk_path" "$APK_PUBLIC_URL" "$APP_VERSION_CODE"
fi
echo "APK ready: $apk_path"
