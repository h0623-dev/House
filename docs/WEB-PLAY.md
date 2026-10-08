# 로드헤이븐 웹 플레이 배포

v0.8.0은 정적 웹 호스팅에서 실행할 수 있습니다. 웹 버전 저장 데이터는 해당 브라우저에 보관되며 Android 앱과 별도로 관리됩니다.

## 준비된 파일

- `artifacts/web-play/`: 웹 서버에 올릴 정적 사이트. `index.html`, `assets/`, `fonts/`, `.nojekyll`을 함께 배포합니다.
- `artifacts/road-haven-0.8.0-web.zip`: 위 디렉터리 내용이 압축 파일의 최상위에 들어 있는 배포용 ZIP입니다.
- `artifacts/road-haven-0.8.0-play.html`: 코드·스타일·폰트를 모두 포함하는 단일 HTML입니다. 재생성은 `node scripts/build-standalone.mjs`로 할 수 있습니다.

`fonts/OFL-NotoSansKR.txt`와 `fonts/OFL-DMSans.txt`는 포함된 글꼴의 라이선스입니다. 배포할 때 함께 보관하세요. 생성된 `artifacts/` 디렉터리는 소스 저장소의 Git 추적에서 제외됩니다.

## 정적 사이트 다시 빌드하기

저장소 루트에서 실행합니다. 의존성이 설치되어 있지 않다면 먼저 `npm ci`를 실행합니다.

```bash
npx --no-install tsc --noEmit
npx --no-install vite build --base=./ --outDir artifacts/web-play
touch artifacts/web-play/.nojekyll
cp node_modules/@fontsource-variable/dm-sans/LICENSE artifacts/web-play/fonts/OFL-DMSans.txt
python3 - <<'PY'
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

version = json.loads(Path('package.json').read_text())['version']
root = Path('artifacts/web-play')
with ZipFile(f'artifacts/road-haven-{version}-web.zip', 'w', ZIP_DEFLATED) as archive:
    for source in sorted(root.rglob('*')):
        if source.is_file():
            archive.write(source, source.relative_to(root))
PY
```

Vite의 `--base=./` 옵션은 HTML의 JavaScript/CSS와 CSS의 공개 폰트 경로를 상대 경로로 생성합니다. 별도 소스 수정이나 CSS 경로 치환은 필요하지 않습니다. 현재 결과는 HTML에서 `./assets/…`, CSS에서 `./dm-sans-….woff2`와 `../fonts/NotoSansKR-Variable.ttf`를 사용하므로 `/House/` 같은 하위 경로에서 실행할 수 있습니다.

## GitHub Pages 설정

공개 주소의 외부 접속은 아직 검증되지 않았습니다. 아래 주소는 Pages 설정과 배포가 성공했을 때 사용할 예상 주소입니다.

`https://h0623-dev.github.io/House/`

GitHub Pages를 사용할 수 있는 저장소와 설정 권한이 필요합니다. `artifacts/web-play/`의 내용이 원격 저장소의 `gh-pages` 브랜치 최상위에 게시된 뒤, [저장소의 Pages 설정](https://github.com/h0623-dev/House/settings/pages)에서 다음과 같이 설정합니다.

1. **Build and deployment → Source**: **Deploy from a branch**
2. **Branch**: **gh-pages**, 폴더: **/(root)**
3. **Save** 후 Pages 배포 완료를 확인합니다.
4. GitHub가 표시하는 사이트 주소를 일반 브라우저에서 열고 새 게임과 전투 입장을 확인합니다.

설정에 표시되는 실제 주소와 배포 상태를 기준으로 운영하세요. 소스가 있는 `main` 브랜치를 그대로 지정하면 Vite 소스가 정적 게임으로 빌드되지 않습니다. 후속 웹 업데이트는 위 명령으로 다시 빌드하고 정적 사이트 내용을 배포 브랜치에 갱신합니다. 웹 사이트의 Pages 활성화와 Android 업데이트 파일 배포는 별개입니다. Android의 공개 `update.json`과 버전별 APK는 같은 `gh-pages`의 raw GitHub 주소를 사용하며 [Android 안내](ANDROID.md)에 기록했습니다.

## 확인한 내용

- 정적 파일을 로컬 서버의 `/House/` 경로 아래에 배치하고 360×740 및 390×844 모바일 Chromium에서 인게임 아이콘 버튼과 작은 하단 제목, 실제 밭 터치 선택, 심기·급수·수확, 벌목·확장, 3개 전투 지역, 저장 복구를 확인했습니다.
- 남녀 일러스트·작업 포즈와 세계·동물·좀비·전투·아이템 그림을 포함하여 JavaScript, CSS, 이미지, DM Sans 및 Noto Sans KR 폰트 요청이 모두 `/House/` 아래에서 성공했습니다. 실패한 요청과 실행 오류는 없었습니다.
- 정적 배포 파일에서 개발 서버 주소, Vite 개발 클라이언트, 소스맵 참조 및 일반적인 토큰·개인키 형식이 발견되지 않았습니다.
- 단일 HTML은 로컬 HTTP로 열어 농사·벌목·확장·전투 승리와 저장·재접속을 확인했습니다. 로드 후 오프라인 상태에서도 동작했고 외부 리소스를 요청하지 않았습니다.
- 테스트 환경의 관리형 Chromium은 `file://` 탐색을 차단하므로 단일 HTML을 파일로 직접 여는 방식은 이 환경에서 검증하지 못했습니다.


게임 콘텐츠 자동 업데이트는 Android 앱의 전용 기능입니다. 웹과 단일 HTML은 현재 포함된 버전을 실행하며 Android의 저장 및 다운로드 공간과 별개입니다.
