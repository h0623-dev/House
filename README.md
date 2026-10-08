# 로드헤이븐: 트럭 위의 우리집

2187년 대한민국, 좀비로 가득한 도로에서 거대한 트럭을 집으로 가꾸는 모바일 생존·생활 게임입니다. 기존 게임의 자산이나 코드를 사용하지 않은 독자적인 모바일 플레이 버전입니다.

## 0.3.0에서 할 수 있는 일

- 원본 애니메이션 일러스트로 제작한 남녀 생존자, 작업·이동·전투 포즈와 이름 변경
- 화면 안의 큰 아이콘 버튼과 작은 행동 제목, 밭 선택 후 바로 심기·급수·수확
- 휴대폰 화면에 맞춘 자원·체력 표시와 하단 메뉴, 작업 중 중복 입력 방지
- 도로 위 트럭 집, 서울 표지판, 움직이는 캐릭터와 반려견 **보리**
- 캐릭터가 직접 밭으로 걸어가 당근 심기 → 물 주기 → 성장 → 수확
- 도로 옆 벌목장에서 직접 나무 베기, 도로 탐색, 식량·물·목재·고철·씨앗 관리
- 숲길·한강 교량·남산 검문소 전투 스테이지: 각 3웨이브와 보스
- 보리 동행, 자동 기본 공격과 광역 공격·돌진·회복 기술, AUTO 기술 모드
- 트럭 6레벨까지 눈에 띄게 넓어지는 데크·통로·울타리, 최대 8개 텃밭
- 체력·기력·행복 관리, 휴식, 트럭 수리
- 밤사이 좀비에 의한 트럭 손상과 매일의 식량 소비
- 목표 3개, 경험치·레벨, 여행 일지
- 기기 자동 저장, 일시정지, 효과음
- Android APK와 HTTPS 업데이트 알림 기반

농사·벌목·확장은 캐릭터의 이동과 작업 연출이 끝난 뒤 자원에 반영됩니다. 사냥은 별도 전투 화면에서 진행되며 승리 보상은 귀환할 때 한 번만 지급합니다. 앱을 종료한 원정은 재실행 시 보상 없이 복구됩니다. 자유 조이스틱 이동과 멀티플레이는 포함하지 않습니다. 앱이 꺼져 있으면 농작물 성장과 자원 소비도 멈춥니다. 게임과 글꼴은 APK에 포함되어 기본 플레이에 인터넷이 필요하지 않습니다. 업데이트 확인과 다운로드에는 인터넷이 필요합니다.

## Android에서 플레이

업데이트 APK: `artifacts/road-haven-0.3.0-debug.apk` (Android 버전 코드 3).

기존 0.1.0 또는 0.2.0을 삭제하지 말고 새 APK를 열어 업데이트 설치하세요. 동일한 앱 ID와 서명 키를 사용하며 기존 저장 데이터를 자동 호환합니다.

Android 6.0 이상과 최신 Android System WebView가 필요합니다. APK를 휴대폰에 옮겨 파일 앱에서 열고 설치를 승인합니다. 사용자가 해당 파일 앱/브라우저의 ‘알 수 없는 앱 설치’를 허용해야 할 수 있습니다. 테스트 버전은 개발용 서명이며 공개 스토어에 게시하지 않았습니다.

같은 서명 키로 설치하는 후속 APK는 게임 데이터를 유지합니다. 앱 삭제나 앱 데이터 초기화는 로컬 저장을 지웁니다. 현재 클라우드의 테스트 서명 키는 저장소 밖 `/workspace/.road-haven-signing/debug.keystore`에 보관됩니다. 정식 릴리스 서명으로 전환할 때는 테스트 APK와 서명이 다를 수 있습니다.

## 개발 실행

Node.js 22 이상을 사용합니다. 이 클라우드 작업은 이미 격리되어 있으므로 `/workspace/House`의 기존 체크아웃을 사용하며 별도 Git worktree를 만들 필요가 없습니다.

```bash
cd /workspace/House
npm ci
npm run dev
```

```bash
npm test              # 게임 로직·저장 데이터·업데이트 검증
npm run build         # TypeScript 검사 및 배포용 웹 빌드
npm run test:browser  # 개발 서버가 실행 중일 때 모바일 플레이 검사
npm run android:debug
```

브라우저 테스트는 `/usr/bin/chromium`을 사용하며 `CHROMIUM_PATH`로 변경할 수 있습니다. 서버 주소는 `TEST_BASE_URL`로 변경할 수 있습니다. 개발 중 HMR이 전체 플레이 검사를 중단할 수 있으므로 최종 검증에는 빌드된 정적 서버를 권장합니다. 테스트는 브라우저 시계를 제어해 작업과 전투의 실제 프레임을 진행합니다. 빌드 도구가 없는 클라우드에서는 먼저 `bash scripts/setup-android-cloud.sh`를 실행합니다. Android JDK/SDK 준비, 공식 아티팩트 검증, SDK 라이선스 수락을 수행합니다.

## APK 업데이트

`main` 푸시마다 GitHub Actions가 테스트와 APK 빌드를 실행하고 결과를 artifact로 제공합니다. 소스는 `h0623-dev/House`의 `main`, 웹 배포 파일은 `gh-pages`에 게시합니다. Pages 활성화와 공개 접속 확인은 별도입니다.

앱은 시작·복귀 시 설정된 HTTPS 버전 파일을 확인합니다. 새 버전이 있으면 알리고, 플레이어가 ‘새 APK 다운로드’를 누르면 Android 브라우저로 다운로드를 엽니다. **Android의 설치 확인은 사용자가 해야 합니다.**

0.3.0 Android APK부터 `https://raw.githubusercontent.com/h0623-dev/House/gh-pages/update.json`에서 새 버전을 확인합니다. 같은 서명으로 만든 APK와 버전 정보를 `gh-pages`에 게시하면 앱 시작·복귀 때 업데이트를 알립니다. 기존 0.1/0.2 앱에는 주소가 없으므로 0.3 APK를 한 번 직접 설치해야 합니다. [Android 배포 안내](docs/ANDROID.md)에 절차를 기록했습니다.

- `VITE_UPDATE_MANIFEST_URL`: 공개 HTTPS 버전 파일 주소
- `release-version.json`: 기본 Android 버전 코드
- `APP_VERSION_CODE`: 필요할 때 기본값을 재정의하는 증가하는 Android 버전 코드
- `ANDROID_KEYSTORE_*`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`: 정식 빌드의 보안 서명 설정

서명 키나 비밀번호를 소스 코드 또는 `VITE_` 변수에 넣지 마세요. 자세한 내용은 [docs/ANDROID.md](docs/ANDROID.md)에 있습니다.

## 구조

| 파일 | 역할 |
| --- | --- |
| `src/game.ts` | 순수 게임 상태·행동·저장 검증 |
| `src/scene.ts` | 아이소메트릭 트럭·벌목장, 이동/작업 연출, 확장 기하 |
| `src/actors.ts`, `src/character-art.ts`, `src/assets/` | 남녀 캐릭터의 애니메이션 일러스트와 작업·전투 포즈 |
| `src/battle.ts`, `src/battle-view.ts` | 전투 시뮬레이션과 모바일 전투 화면 |
| `src/main.ts` | 반응형 UI·자동 저장·플레이 흐름 |
| `src/update.ts` | 버전 파일 검사와 다운로드 연결 |
| `android/` | Capacitor Android 프로젝트와 네이티브 업데이트 브리지 |
| `scripts/` | 검증된 개발 도구 설치·APK 빌드·버전 파일 생성 |
| `tests/` | 게임·업데이트 단위 테스트와 모바일 브라우저 검사 |

검증: 게임·전투·업데이트 단위 테스트 36개, TypeScript/배포 빌드. 모바일 검사는 작업 완료 전 자원 미지급, 농사·벌목·확장, 3웨이브 전투·기술·일시정지·승리·철수, 구 저장 호환과 중단된 원정 복구를 포함합니다. APK 서명 및 패키지 정보는 Android 빌드 도구로 검사합니다. 실제 휴대폰 설치 및 기존 앱 위 업데이트는 별도 기기 검증이 필요합니다.

글꼴은 SIL Open Font License의 Noto Sans KR / DM Sans를 앱에 포함합니다. Noto Sans KR 라이선스는 `public/fonts/OFL-NotoSansKR.txt`, DM Sans 라이선스는 `public/fonts/OFL-DMSans.txt`에 있습니다.
