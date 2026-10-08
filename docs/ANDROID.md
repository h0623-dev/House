# Android APK 빌드와 직접 업데이트 배포

로드헤이븐은 Capacitor 7 기반의 세로 화면 Android 앱입니다. Android 6.0(API 23) 이상, 최신 Android System WebView가 필요합니다. 패키지 ID는 `com.roadhaven.game`입니다. 로컬 저장 데이터는 같은 서명 키와 패키지 ID를 유지한 업데이트에서 보존됩니다.

## 이번 테스트 APK

`artifacts/road-haven-0.5.0-debug.apk`는 Android 버전 코드 5의 플레이 테스트 빌드입니다. 이전 0.1.0·0.2.0·0.3.0·0.4.0 APK와 같은 패키지 ID와 서명 키를 사용합니다. 기존 앱을 삭제하지 않고 새 APK를 열어 업데이트하면 로컬 저장을 유지할 수 있습니다. Android 파일 앱에서 APK를 열고 설치를 승인하면 됩니다. 해당 파일 앱/브라우저의 “알 수 없는 앱 설치” 허용이 필요할 수 있습니다. 이 설정은 기기에서 사용자가 직접 결정합니다.

클라우드의 테스트 서명 키는 저장소 밖 `../.road-haven-signing/debug.keystore`에 보관됩니다. 다음 테스트 빌드도 이 파일을 재사용해야 기존 앱에 덮어 설치할 수 있습니다. 테스트 키는 정식 배포에 사용하지 마세요. CI에서 키 없이 만든 테스트 APK는 실행마다 서명이 달라질 수 있어 지속 업데이트 배포용이 아닙니다.

## 로컬 빌드

필요 도구: Node.js 22 이상, JDK 21, Android SDK platform 35, build-tools 34.0.0/35.0.0. Android Studio SDK Manager 또는 공식 Android command-line tools로 설치합니다. 클라우드 작업은 이미 격리되어 있으므로 기존 `/workspace/House` 체크아웃을 사용하며 별도 Git worktree가 필요하지 않습니다.

현재와 같은 Linux x64 클라우드에서는 `bash scripts/setup-android-cloud.sh`가 공식 JDK/Android 도구를 검증하여 `/workspace`에 설치하고 SDK 라이선스를 수락합니다. 이미 설치한 도구는 재사용합니다. 직접 설치하려면 다음을 참고하세요.

```bash
npm ci
export ANDROID_HOME=/workspace/android-sdk
export ANDROID_USER_HOME=/workspace/.android
export GRADLE_USER_HOME=/workspace/.gradle
# 공식 sdkmanager가 이미 설치되어 있는 경우:
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" 'platforms;android-35' 'build-tools;34.0.0' 'build-tools;35.0.0'
bash scripts/build-android.sh debug
```

환경에 HTTPS 프록시가 있으면 Gradle의 `systemProp.https.proxyHost`, `systemProp.https.proxyPort`, `systemProp.http.proxyHost`, `systemProp.http.proxyPort`를 사용자 `GRADLE_USER_HOME/gradle.properties`에 지정합니다. 플랫폼의 CA 신뢰를 유지하며 TLS 검증을 끄지 않습니다. SDK Manager에는 해당 프록시 옵션을 전달합니다. 저장소의 Gradle 배포 파일은 SHA-256으로 검증됩니다.

빌드 스크립트는 웹 빌드 → Capacitor 동기화 → APK 생성 → APK 서명 검증 → SHA-256 기록을 수행합니다. 버전 이름은 `package.json`의 `version`, 기본 Android 버전 코드는 `release-version.json`의 `versionCode`에서 읽습니다. 다음 배포마다 두 값을 함께 올리세요. `APP_VERSION_CODE` 환경 변수로 코드만 명시적으로 덮어쓸 수도 있습니다. 웹 표시 버전과 Android 버전은 같은 값을 사용합니다.

설치된 앱을 업데이트하는 APK는 이전 파일과 호환성 검사를 함께 수행하세요. 아래 명령은 새 APK를 내보내기 전에 두 APK의 유효한 서명, 동일한 서명 인증서와 패키지 ID, 증가한 버전 코드를 검사합니다. 기존 테스트 APK가 있는데 원래 키 파일이 없으면 빌드는 새 키를 만들지 않고 복구를 요청합니다.

```bash
PREVIOUS_APK_PATH=artifacts/road-haven-0.4.0-debug.apk \
  bash scripts/build-android.sh debug
# 이미 생성한 두 APK만 검사할 수도 있습니다.
node scripts/verify-android-update.mjs artifacts/road-haven-0.4.0-debug.apk \
  artifacts/road-haven-0.5.0-debug.apk
```

## 정식 서명

장기 보관할 정식 서명 키를 별도로 생성하고 안전한 장소에 백업하세요. 키를 잃으면 같은 앱으로 업데이트할 수 없습니다. 키, 비밀번호, APK 안에 넣으면 안 되는 자격 증명은 Git에 저장하지 않습니다.

아래 환경 변수의 값을 보안 설정으로 주입하면 서명된 릴리스 APK를 만들 수 있습니다.

- `ANDROID_KEYSTORE_PATH`: 정식 키 파일의 절대 경로
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`: 서명 설정
- `APP_VERSION_CODE`: 이전 배포보다 큰 정수
- `VITE_UPDATE_MANIFEST_URL`: 앱이 확인할 고정 HTTPS `update.json` 주소

```bash
bash scripts/build-android.sh release
```

앱에 포함되는 `VITE_` 값은 공개 정보입니다. 비밀키나 비밀번호를 넣지 마세요. 최초 테스트 APK와 정식 서명이 다르면 정식 APK로 덮어 설치되지 않습니다. 테스트 앱을 삭제하면 로컬 진행 정보가 사라질 수 있으므로 정식 배포 전에 서명 키를 확정하세요.

## 업데이트 알림과 설치 흐름

앱은 설정된 HTTPS 매니페스트를 확인하고 현재 Android `versionCode`보다 클 때 업데이트를 알립니다. 플레이어가 다운로드를 누르면 Android의 브라우저가 HTTPS APK 주소를 엽니다. 다운로드한 APK는 사용자가 설치를 승인해야 합니다. 백그라운드 자동 설치나 무인 설치는 하지 않습니다.

0.3.0 Android 빌드의 기본 업데이트 주소는 `https://raw.githubusercontent.com/h0623-dev/House/gh-pages/update.json`입니다. 이 공개 GitHub 브랜치의 `downloads/`에 같은 서명의 버전별 APK를 두고, `update.json`에는 해당 APK 주소·체크섬·증가하는 버전 코드를 기록합니다. 기존 0.1/0.2 APK는 이 주소를 포함하지 않으므로 0.3 APK를 한 번 직접 설치해야 합니다.

공개 파일 응답의 CORS 허용과 실제 APK·매니페스트 내용을 확인한 뒤 사용합니다. raw GitHub 캐시로 새 매니페스트가 보이기까지 약 5분 걸릴 수 있습니다. 웹 개발 및 단일 오프라인 HTML은 별도 환경 값이 없으면 업데이트 서버 미연결 상태를 표시합니다. `VITE_UPDATE_MANIFEST_URL`로 다른 소유한 HTTPS 서버를 지정할 수 있으며, 자체 호스팅에는 적절한 CORS와 `Cache-Control: no-cache` 설정을 권장합니다.

```json
{
  "version": "0.4.0",
  "versionCode": 4,
  "apkUrl": "https://your-download-host.example/road-haven-0.4.0-release.apk",
  "sha256": "서명된 APK의 64자리 SHA-256 값",
  "notes": "업데이트 내용",
  "publishedAt": "2026-10-08T00:00:00.000Z"
}
```

실제 APK에서 유효한 매니페스트를 생성합니다.

```bash
node scripts/create-update-manifest.mjs artifacts/road-haven-0.4.0-release.apk \
  https://your-download-host.example/road-haven-0.4.0-release.apk 4
```

APK를 먼저 업로드한 뒤 고정 주소의 `update.json`을 교체하세요. 버전마다 다른 APK 주소를 권장합니다. 제공된 SHA-256은 배포 파일 검증용이며 브라우저에서 내려받는 파일을 앱이 직접 검증하지는 않습니다. Android 설치기는 기존 앱과 서명 일치를 검증합니다. 동일한 패키지 ID, 동일한 정식 서명 키, 더 큰 `versionCode`를 계속 유지해야 합니다.

공개 GitHub 저장소를 사용할 경우 APK는 GitHub Releases의 `https://github.com/OWNER/REPO/releases/download/v0.4.0/road-haven-0.4.0-release.apk` 같은 주소에 올리고, 고정 매니페스트는 `https://raw.githubusercontent.com/OWNER/REPO/main/releases/update.json` 같은 주소에서 제공할 수 있습니다. `OWNER/REPO`는 실제 소유한 공개 저장소로 바꾸고, 앱의 `VITE_UPDATE_MANIFEST_URL`에는 이 고정 매니페스트 주소를 설정합니다. raw GitHub 응답의 CORS 허용과 실제 기기에서의 접근을 확인하세요. GitHub Actions artifact 주소는 로그인/만료가 있으므로 일반 플레이어용 APK 배포 주소로 쓰지 않습니다. 비공개 저장소에는 앱에 GitHub 토큰을 넣는 대신 별도의 공개 배포 저장소 또는 공개 HTTPS 호스팅을 사용하세요. 위 주소는 설명용이며 현재 앱에 설정된 주소가 아닙니다.

## 매 업데이트 APK 생성

`.github/workflows/android.yml`은 `main`에 푸시할 때마다 또는 수동 실행할 때 테스트, APK 빌드, 서명 검증 후 GitHub Actions artifact에 APK와 체크섬을 올립니다. 실제 GitHub에 코드를 푸시하고 Actions를 사용하도록 설정해야 작동합니다. 이 워크플로는 공개 릴리스를 자동 게시하지 않습니다.

GitHub Repository **Secrets**에 `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`를 설정하면 정식 릴리스 APK를 만듭니다. 없으면 테스트 APK를 만듭니다. **Variables**의 `UPDATE_MANIFEST_URL`로 앱의 확인 주소를 지정하고, `APK_PUBLIC_URL`을 지정하면 해당 주소를 담은 `update.json` artifact도 생성합니다. 호스팅 업로드는 별도 배포 단계입니다. Android 버전 코드는 `release-version.json`의 값과 워크플로 실행 번호 + 1 중 큰 값을 사용합니다. 다른 경로로 더 높은 코드를 배포했다면 저장소의 `versionCode`를 그보다 높여야 합니다.

첫 공개 배포 전에는 실제 Android 기기에서 시작, 터치 조작, 앱 종료 후 저장 복구, 브라우저 다운로드, 동일 서명 APK로 업데이트 후 저장 보존을 확인하세요. 클라우드 APK 빌드 성공은 실제 기기 설치 테스트를 대신하지 않습니다.
