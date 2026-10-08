# 게임 콘텐츠 자동 업데이트

0.8.0 APK를 한 번 설치한 앱은 호환되는 게임 코드·그림·스타일을 설치 확인 없이 업데이트합니다. 네이티브 Android 기능 변경에는 별도의 APK와 Android 설치 확인이 필요합니다. 브라우저 버전에는 네이티브 콘텐츠 저장·적용 기능이 없습니다.

앱은 시작·복귀 시 고정 HTTPS 주소 `https://raw.githubusercontent.com/h0623-dev/House/gh-pages/game-update.json`을 확인합니다. 서명된 정보의 버전·네이티브 호환 범위를 확인하고 새 콘텐츠 ZIP을 앱 전용 공간에 다운로드합니다. ECDSA 서명, ZIP SHA-256, 압축 경로·크기·정확한 파일 목록과 각 파일 해시를 검증합니다. 공개 키는 앱에 포함하며 비공개 서명 키는 저장소에 넣지 않습니다.

현재 작업·전투·배치·농사 선택을 마치고 홈에서 저장한 뒤 적용합니다. Capacitor의 같은 로컬 주소에서 새 파일을 실행하므로 저장이 유지됩니다. 새 화면이 정상 시작했다고 확인하기 전에 실패하면 다음 실행에서 이전 콘텐츠로 복구하고 해당 콘텐츠 버전을 다시 적용하지 않습니다. 인터넷이 끊기거나 다운로드·검증에 실패해도 기존 게임을 계속 실행합니다.

## 배포

`release-version.json`의 증가하는 버전 코드를 콘텐츠 버전으로 사용합니다. `content-release.json`은 해당 코드가 지원하는 네이티브 앱 코드의 최소·최대값입니다. 네이티브 기능을 바꾸면 최소값도 새 앱 코드로 올립니다. 게임 코드만 바꾸는 경우 기존 엔진을 지원하는 최소값을 유지합니다. `update.json.minimumNativeVersionCode`는 이 최소값을 사용하므로 호환되는 엔진에는 불필요한 APK 설치를 요청하지 않습니다.

```bash
npm run build
node scripts/create-content-release.mjs dist \
  https://raw.githubusercontent.com/h0623-dev/House/gh-pages/content/road-haven-0.8.0-content.zip
```

도구는 `artifacts/game-update.json`, 콘텐츠 ZIP, SHA-256 파일을 만듭니다. ZIP에는 검증된 웹 빌드만 들어가며 새 서명이 앱에 고정된 공개 키와 맞는지 확인합니다. ZIP을 `gh-pages/content/`에 올린 뒤 마지막에 같은 브랜치의 루트 `game-update.json`을 게시합니다. 미리 테스트하는 미래 버전 정보는 공개하지 않습니다.

이 클라우드의 콘텐츠 서명 키는 저장소 밖 `/workspace/.road-haven-signing/content-update-private.pem`에 보관합니다. 다른 빌드 환경에서는 `CONTENT_SIGNING_KEY_PATH`로 같은 키 파일을 지정합니다. 키의 내용을 문서·소스·로그·채팅에 넣지 않습니다. APK의 기존 Android 서명 키와 콘텐츠 서명 키는 서로 다른 용도입니다.

첫 0.8 앱의 내장 콘텐츠와 공개 콘텐츠의 버전이 같으면 다운로드하지 않습니다. 이후 더 높은 호환 버전만 적용합니다. APK를 새로 설치했을 때 내장 콘텐츠보다 오래되거나 호환되지 않는 캐시는 사용하지 않습니다.

검증은 순수 Java 서명·압축 검사, 업데이트 UI 브리지 모의 검사, 공개 정보의 서명 및 전체 ZIP 파일 해시 검사로 나누어 기록합니다. 실제 Android 기기의 다운로드·재시작·롤백은 기기 검증 여부를 별도로 표시합니다.
