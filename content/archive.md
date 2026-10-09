# 과거 게임 콘텐츠 보관

v0.15 게시에서는 GitHub Pages의 파일 용량을 줄이기 위해 최신 `gh-pages` 파일 목록에서 v0.8·v0.9 콘텐츠 ZIP과 체크섬 파일만 제외합니다. Git 이력은 유지하며, 두 파일은 기존 공개 커밋 `50610bbbe980e0aa6f62f0ece5552aedf9a5f482`의 고정 주소에서 내려받을 수 있습니다. 기존 APK와 v0.10 이상 콘텐츠는 최신 브랜치에 유지합니다.

| 버전 | 보관 다운로드 | 바이트 | SHA-256 |
| --- | --- | ---: | --- |
| 0.8.0 | [road-haven-0.8.0-content.zip](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.8.0-content.zip) · [SHA 파일](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.8.0-content.zip.sha256) | 42,525,251 | `7b8ab4ca73b09a64cd937a50f5989942238411e8b19d01f398e82ade3e713543` |
| 0.9.0 | [road-haven-0.9.0-content.zip](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.9.0-content.zip) · [SHA 파일](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.9.0-content.zip.sha256) | 42,535,901 | `766f5327b3ff8946f638e09bec136d2e8798787ffd4b2ebe477876cb2c11c81c` |

2026-10-09에 고정 주소의 ZIP 전체를 받아 기존 게시 파일과 크기·SHA-256이 일치하는지 확인했습니다. 이 주소는 과거 콘텐츠 보관과 검증용입니다. 자동 업데이트 매니페스트와 자동 롤백 주소로 사용하지 않습니다. 최신 앱 업데이트는 [game-update.json](../game-update.json)의 서명된 v0.15 콘텐츠를 사용하며 네이티브 8–15를 지원합니다.

[콘텐츠 업데이트 안내](https://github.com/h0623-dev/House/blob/main/docs/CONTENT-UPDATES.md)
