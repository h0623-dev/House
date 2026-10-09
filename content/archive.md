# 과거 게임 콘텐츠 보관

## v0.16 보관

v0.16 게시에서는 v0.10·v0.11 콘텐츠 ZIP·체크섬 파일만 최신 파일 목록에서 추가로 제외합니다. 기존 APK 전체와 v0.12·v0.13·v0.14·v0.15 콘텐츠는 유지하며 Git 이력을 삭제하거나 다시 쓰지 않습니다. 두 ZIP은 기존 공개 커밋 `16e6caffb61b217f6df95b4a233375400cc0f8d3`의 고정 주소에서 내려받을 수 있습니다.

| 버전 | 보관 다운로드 | 바이트 | SHA-256 |
| --- | --- | ---: | --- |
| 0.10.0 | [ZIP](https://raw.githubusercontent.com/h0623-dev/House/16e6caffb61b217f6df95b4a233375400cc0f8d3/content/road-haven-0.10.0-content.zip) · [SHA 파일](https://raw.githubusercontent.com/h0623-dev/House/16e6caffb61b217f6df95b4a233375400cc0f8d3/content/road-haven-0.10.0-content.zip.sha256) | 42,362,051 | `5eddfb17ef0d4572398d3dda6914bbed47932a60ef56fbac6cc4895eee35d3e1` |
| 0.11.0 | [ZIP](https://raw.githubusercontent.com/h0623-dev/House/16e6caffb61b217f6df95b4a233375400cc0f8d3/content/road-haven-0.11.0-content.zip) · [SHA 파일](https://raw.githubusercontent.com/h0623-dev/House/16e6caffb61b217f6df95b4a233375400cc0f8d3/content/road-haven-0.11.0-content.zip.sha256) | 46,338,538 | `0d121dcaa656cd23def9afca025b7d7d9621fe855833b8d3d9bdd19e3d04996e` |

2026-10-09에 ZIP 전체와 SHA 파일의 HTTP 200 응답·전체 바이트·SHA-256 일치를 검증했습니다. 보관 주소는 과거 다운로드와 검증용이며 현재 앱 업데이트나 자동 롤백 주소가 아닙니다. 현재 업데이트는 [game-update.json](../game-update.json)의 서명된 v0.16 콘텐츠를 사용하며 네이티브 8–16을 지원합니다.


v0.15 게시에서는 GitHub Pages의 파일 용량을 줄이기 위해 최신 `gh-pages` 파일 목록에서 v0.8·v0.9 콘텐츠 ZIP과 체크섬 파일만 제외합니다. Git 이력은 유지하며, 두 파일은 기존 공개 커밋 `50610bbbe980e0aa6f62f0ece5552aedf9a5f482`의 고정 주소에서 내려받을 수 있습니다. 기존 APK와 v0.10 이상 콘텐츠는 최신 브랜치에 유지합니다.

| 버전 | 보관 다운로드 | 바이트 | SHA-256 |
| --- | --- | ---: | --- |
| 0.8.0 | [road-haven-0.8.0-content.zip](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.8.0-content.zip) · [SHA 파일](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.8.0-content.zip.sha256) | 42,525,251 | `7b8ab4ca73b09a64cd937a50f5989942238411e8b19d01f398e82ade3e713543` |
| 0.9.0 | [road-haven-0.9.0-content.zip](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.9.0-content.zip) · [SHA 파일](https://raw.githubusercontent.com/h0623-dev/House/50610bbbe980e0aa6f62f0ece5552aedf9a5f482/content/road-haven-0.9.0-content.zip.sha256) | 42,535,901 | `766f5327b3ff8946f638e09bec136d2e8798787ffd4b2ebe477876cb2c11c81c` |

2026-10-09에 고정 주소의 ZIP 전체를 받아 기존 게시 파일과 크기·SHA-256이 일치하는지 확인했습니다. 이 주소는 과거 콘텐츠 보관과 검증용입니다. 자동 업데이트 매니페스트와 자동 롤백 주소로 사용하지 않습니다. 최신 앱 업데이트는 [game-update.json](../game-update.json)의 서명된 v0.16 콘텐츠를 사용하며 네이티브 8–16을 지원합니다.

[콘텐츠 업데이트 안내](https://github.com/h0623-dev/House/blob/main/docs/CONTENT-UPDATES.md)

## v0.17 보관

v0.12·v0.13 콘텐츠 ZIP과 체크섬은 아래 기존 공개 커밋의 고정 주소에서 그대로 보관합니다. 전체 파일을 HTTPS로 받아 이전 게시 파일의 바이트 수·SHA-256과 일치하는지 2026-10-09에 확인했습니다. APK 전체와 최근 v0.14–v0.16 콘텐츠는 현재 브랜치에 유지하며 Git 이력을 삭제하거나 다시 쓰지 않습니다. 앱은 현재 `game-update.json`의 호환되는 v0.17 콘텐츠를 사용합니다. 이 과거 보관 주소를 자동 롤백 주소로 설정하지 않습니다.

| 콘텐츠 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.12 ZIP](https://raw.githubusercontent.com/h0623-dev/House/32f8686b87c4923b5709b498841f1d4c90f17b9f/content/road-haven-0.12.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/32f8686b87c4923b5709b498841f1d4c90f17b9f/content/road-haven-0.12.0-content.zip.sha256) | 46,339,317 | `3884fa48e6c66fc8b8f58f0f3d8d19da54be900955e456dcef2a383d517935b3` |
| [v0.13 ZIP](https://raw.githubusercontent.com/h0623-dev/House/32f8686b87c4923b5709b498841f1d4c90f17b9f/content/road-haven-0.13.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/32f8686b87c4923b5709b498841f1d4c90f17b9f/content/road-haven-0.13.0-content.zip.sha256) | 46,341,444 | `c37a9e283c4148a3f4fbc069ab9e8489f3a7b4a6bc955ee5c02752df472aa25e` |

## v0.18 보관

v0.14·v0.15·v0.16 콘텐츠 ZIP·체크섬은 아래 기존 공개 커밋의 고정 주소에 그대로 보관합니다. 전체 파일을 정상 HTTPS로 받아 이전 게시 파일의 바이트 수·SHA-256과 일치하는지 확인했습니다. 기존 APK 전체와 v0.17 콘텐츠를 현재 트리에 유지하고 Git 이력은 삭제하거나 다시 쓰지 않습니다. 최신 앱 업데이트는 서명된 현재 game-update.json을 사용하며 이 보관 URL을 자동 롤백 대상으로 설정하지 않습니다.

| 콘텐츠 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.14 ZIP](https://raw.githubusercontent.com/h0623-dev/House/61d5fed2f1fa2bd05272d909c6706292e8f02492/content/road-haven-0.14.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/61d5fed2f1fa2bd05272d909c6706292e8f02492/content/road-haven-0.14.0-content.zip.sha256) | 46,346,954 | `c0dcf880ca84c165507e51b0ea76fbeb0f4c987b9f6e7c5abc9b57d4afbd4e45` |
| [v0.15 ZIP](https://raw.githubusercontent.com/h0623-dev/House/61d5fed2f1fa2bd05272d909c6706292e8f02492/content/road-haven-0.15.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/61d5fed2f1fa2bd05272d909c6706292e8f02492/content/road-haven-0.15.0-content.zip.sha256) | 46,347,011 | `0eef40b76c7632d5ac8f86f6c8176778534554d26b930575a916eb164e513e02` |
| [v0.16 ZIP](https://raw.githubusercontent.com/h0623-dev/House/61d5fed2f1fa2bd05272d909c6706292e8f02492/content/road-haven-0.16.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/61d5fed2f1fa2bd05272d909c6706292e8f02492/content/road-haven-0.16.0-content.zip.sha256) | 48,007,391 | `b66212829ebb500618296053bb98933a6535b59e4d5a3193ea124c42766ca336` |

## v0.19 보관

v0.17·v0.18 콘텐츠 ZIP·체크섬은 아래 기존 공개 커밋의 고정 주소에 그대로 보관합니다. 전체 파일을 정상 HTTPS로 받아 이전 게시 파일의 바이트 수·SHA-256과 일치하는지 확인했습니다. 기존 APK 전체와 최신 v0.19 콘텐츠를 현재 트리에 유지하고 Git 이력은 삭제하거나 다시 쓰지 않습니다. 최신 앱 업데이트는 서명된 현재 game-update.json을 사용하며 이 보관 URL을 자동 롤백 대상으로 설정하지 않습니다.

| 콘텐츠 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.17 ZIP](https://raw.githubusercontent.com/h0623-dev/House/9dd4de9d616a7248b9fb452ac48397b8b892d423/content/road-haven-0.17.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/9dd4de9d616a7248b9fb452ac48397b8b892d423/content/road-haven-0.17.0-content.zip.sha256) | 49,434,259 | `b5efc6bb8ec0b14538adf0a0cbd06a0ec253faef592645469ac37d04c61dfb03` |
| [v0.18 ZIP](https://raw.githubusercontent.com/h0623-dev/House/9dd4de9d616a7248b9fb452ac48397b8b892d423/content/road-haven-0.18.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/9dd4de9d616a7248b9fb452ac48397b8b892d423/content/road-haven-0.18.0-content.zip.sha256) | 52,699,032 | `a9ac407ed479c903c2a7680679136ded689b57fee85f262aa4ff5f52f75d915d` |

## v0.20 보관

v0.19 콘텐츠 ZIP과 v0.4 APK 및 각 체크섬은 아래 이전 공개 커밋의 고정 주소에 그대로 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수·SHA-256과 일치하는지 확인했습니다. Git 이력은 삭제하거나 다시 쓰지 않으며 현재 트리에는 나머지 APK와 최신 v0.20 콘텐츠를 유지합니다. 이전 APK를 포함한 18개 릴리즈는 계속 접근할 수 있습니다. 최신 앱 업데이트는 현재의 서명된 game-update.json을 사용하며 이 보관 주소를 자동 롤백 대상으로 설정하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.19 콘텐츠 ZIP](https://raw.githubusercontent.com/h0623-dev/House/a9435d83f7139d0f778fafbddc47c17cedcae856/content/road-haven-0.19.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/a9435d83f7139d0f778fafbddc47c17cedcae856/content/road-haven-0.19.0-content.zip.sha256) | 52,699,027 | `dc95d0843d9e93ea96a006547743d0cebfe25a62317e35b291201c5e1e9e87af` |
| [v0.4 APK](https://raw.githubusercontent.com/h0623-dev/House/a9435d83f7139d0f778fafbddc47c17cedcae856/downloads/road-haven-0.4.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/a9435d83f7139d0f778fafbddc47c17cedcae856/downloads/road-haven-0.4.0-debug.apk.sha256) | 46,342,599 | `6a355f73425d6bf4f9d5fe457e1d4c89ed4f9e7987bfc734c5447bc665579c54` |
