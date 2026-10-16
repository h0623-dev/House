# 별도 설치 가로 Android 앱

기존 앱과 저장을 남겨두고 새로 시작하는 별도 Android 앱입니다. 사용자가 별도 설치·새 마을 시작을 승인한 뒤 생성한 독립 신원을 사용합니다.

| 항목 | 기존 앱 | 가로 앱 |
| --- | --- | --- |
| 앱 ID | `com.roadhaven.game` | `com.roadhaven.landscape` |
| 이름 | 로드헤이븐 | 로드헤이븐 가로 |
| 업데이트 브랜치 | `gh-pages` | `landscape-releases` |
| 콘텐츠 서명키 | 기존 공개키 유지 | 독립 P-256 키 |
| 저장 | 기존 앱 전용 | 별도 새 마을 |

가로 앱은 `sensorLandscape`로 두 가로 방향을 지원합니다. 이전 앱을 지울 필요가 없고, 두 앱의 저장은 자동으로 이전되지 않습니다. Android namespace와 Activity의 Java 클래스 이름은 `com.roadhaven.game`을 유지하지만 설치 ID·FileProvider·앱 데이터는 분리합니다.

## 제작

JDK21 `/workspace/java/current`, SDK35 `/workspace/android-sdk`, npm 의존성을 준비한 다음 실행합니다.

```bash
node scripts/build-landscape-android.mjs
```

최초 신원 생성 때만 `--initialize-signing`을 사용했습니다. 공개 신원이 `landscape-release.json`에 기록된 뒤에는 이 옵션으로 다시 키를 만들 수 없습니다. 키가 사라지면 원래 가로 앱 키를 복원해야 합니다. 기존 앱의 키를 대신 생성하거나 핀을 바꾸지 않습니다.

개인 파일은 Git 바깥 `/workspace/.road-haven-landscape-signing/`에 권한 0700/0600으로 보관합니다. `/workspace/.road-haven-landscape-signing-backup.zip`은 이 별도 앱의 키와 암호 설정을 담은 비공개 복원용 백업입니다. 공개 배포 브랜치·Git·CI 업로드·로그에 포함하지 않습니다. 이 파일은 안전한 개인 저장소에 따로 보관해야 하며, 환경 설정 초안 저장만으로 새 작업 환경에 복원된다고 가정하지 않습니다.

제작 도구는 공개 인증서 지문과 콘텐츠 공개키가 보관한 키와 일치해야 진행합니다. 기존 앱 ID를 사용할 수 없으며, 별도 앱 이름·설치 ID·가로 방향과 서명을 갖는 APK를 `artifacts/road-haven-landscape-VERSION.apk`에 기록합니다. 같은 파일이 있으면 덮어쓰지 않습니다. 컴파일·번들·APK 서명 처리는 플레이 테스트와 구별합니다.

## 배포 및 자동 패치

독립 브랜치의 다운로드 주소는 다음 형태입니다.

```text
https://raw.githubusercontent.com/h0623-dev/House/landscape-releases/downloads/road-haven-landscape-VERSION.apk
https://raw.githubusercontent.com/h0623-dev/House/landscape-releases/update.json
https://raw.githubusercontent.com/h0623-dev/House/landscape-releases/game-update.json
https://raw.githubusercontent.com/h0623-dev/House/landscape-releases/content/road-haven-landscape-VERSION-content.zip
```

별도 브랜치는 기존 웹 배포의 1GB 공간을 사용하지 않습니다. 기존 `gh-pages`의 APK·앱 패치·웹 PWA·배포 이력을 변경하지 않습니다. APK·콘텐츠 ZIP은 먼저 올리고, 같은 서명과 호환 범위를 갖는 메타데이터를 함께 게시합니다. 실제 공개 APK와 메타데이터 응답을 받은 뒤 사용자에게 링크를 제공합니다.

v0.48 콘텐츠의 네이티브 호환 범위는 42~48입니다. 가로 앱 v0.42~v0.47은 APK를 다시 설치하지 않고 이번 게임 콘텐츠를 받을 수 있습니다. 후속 게임 콘텐츠도 새 앱의 동일한 콘텐츠 개인키로 서명하여 해당 독립 채널에 게시합니다. 호환 콘텐츠는 기존 시작 패치 화면과 안전한 저장·적용 절차로 자동 반영됩니다. Android 앱 자체 기능을 바꿀 때는 같은 APK 서명키로 앱 버전 코드를 올려 제공하며, 최종 설치 확인은 Android에서 진행합니다.

새 APK와 같은 버전의 콘텐츠를 제작할 때 `node scripts/create-landscape-release.mjs WEB_DIRECTORY SIGNED_APK`를 사용합니다. 별도 앱 설정과 실제 APK 서명·앱 ID·네이티브 공개키를 맞춘 다음 전용 staging 폴더에 APK·서명된 콘텐츠 ZIP·두 메타데이터만 준비합니다. 공개 전에는 APK·ZIP·메타데이터가 모두 같은 릴리스인지 확인하고 `landscape-releases`에 게시합니다. 개인키 백업을 배포 staging에 넣지 않습니다.

새 콘텐츠는 항상 가로 앱용 `VITE_UPDATE_MANIFEST_URL`로 빌드해야 합니다. 기존 앱용 번들이 가로 앱의 APK 업데이트 주소를 덮어쓰지 않도록 합니다. 공개 `landscape-release.json`에는 개인키나 암호가 없으며, 앞으로도 같은 인증서·콘텐츠 공개키를 유지합니다.
