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

## v0.21 보관

v0.20 콘텐츠 ZIP과 v0.3·v0.5 APK 및 각 체크섬은 아래 이전 공개 커밋의 고정 주소에 그대로 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수·SHA-256과 일치하는지 확인했습니다. Git 이력은 삭제하거나 다시 쓰지 않으며 현재 트리에는 나머지 APK와 최신 v0.21 콘텐츠를 유지합니다. 이전 APK를 포함한 19개 릴리즈는 계속 접근할 수 있습니다. 최신 앱 업데이트는 현재의 서명된 game-update.json을 사용하며 이 보관 주소를 자동 롤백 대상으로 설정하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.20 콘텐츠 ZIP](https://raw.githubusercontent.com/h0623-dev/House/421eb36e98f46842fbdaad32e656f3feff8b987b/content/road-haven-0.20.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/421eb36e98f46842fbdaad32e656f3feff8b987b/content/road-haven-0.20.0-content.zip.sha256) | 52,705,729 | `6accfe4362ceeeb66dabc9d0707245c0998e73b326733da231630f7516fc615c` |
| [v0.3 APK](https://raw.githubusercontent.com/h0623-dev/House/421eb36e98f46842fbdaad32e656f3feff8b987b/downloads/road-haven-0.3.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/421eb36e98f46842fbdaad32e656f3feff8b987b/downloads/road-haven-0.3.0-debug.apk.sha256) | 14,743,709 | `42a335cd5ff529aaa12c62521dce2f59f36a3293b544e189ab22fee2e98eadfe` |
| [v0.5 APK](https://raw.githubusercontent.com/h0623-dev/House/421eb36e98f46842fbdaad32e656f3feff8b987b/downloads/road-haven-0.5.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/421eb36e98f46842fbdaad32e656f3feff8b987b/downloads/road-haven-0.5.0-debug.apk.sha256) | 46,344,598 | `9957ce3136665659e8ad8a029fd0431a8903ce74a94d4067b47bd5642d6f7fba` |

## v0.22 보관

v0.21 콘텐츠 ZIP과 v0.6·v0.7 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 20개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.21 콘텐츠 ZIP](https://raw.githubusercontent.com/h0623-dev/House/4d7ee65653786a6f69e80fc640aabfcba691a3f1/content/road-haven-0.21.0-content.zip) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/4d7ee65653786a6f69e80fc640aabfcba691a3f1/content/road-haven-0.21.0-content.zip.sha256) | 52,720,387 | `a8db9e3a3dd86c7108709914f44a34753dea9161294ff6abc4d959aab7bd52b5` |
| [v0.6 APK](https://raw.githubusercontent.com/h0623-dev/House/4d7ee65653786a6f69e80fc640aabfcba691a3f1/downloads/road-haven-0.6.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/4d7ee65653786a6f69e80fc640aabfcba691a3f1/downloads/road-haven-0.6.0-debug.apk.sha256) | 48,086,898 | `2030fd0e20939bfb8da0bf0262f91146cde045acce64896bc096bfd4ecd9bfec` |
| [v0.7 APK](https://raw.githubusercontent.com/h0623-dev/House/4d7ee65653786a6f69e80fc640aabfcba691a3f1/downloads/road-haven-0.7.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/4d7ee65653786a6f69e80fc640aabfcba691a3f1/downloads/road-haven-0.7.0-debug.apk.sha256) | 48,090,022 | `f4b4116b504cb439df0fcaba3d9cbfa1314e1f6d264dce20c52881d23db0d07a` |

## v0.23 보관

v0.8·v0.9 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 21개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.8 APK](https://raw.githubusercontent.com/h0623-dev/House/4b5ee347ae501df1bc2c744cb261d829abfdb6f2/downloads/road-haven-0.8.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/4b5ee347ae501df1bc2c744cb261d829abfdb6f2/downloads/road-haven-0.8.0-debug.apk.sha256) | 50,711,318 | `99afde7364c33e84c02dffc2df102f6ab816197432e8dee5d95790906df2419b` |
| [v0.9 APK](https://raw.githubusercontent.com/h0623-dev/House/4b5ee347ae501df1bc2c744cb261d829abfdb6f2/downloads/road-haven-0.9.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/4b5ee347ae501df1bc2c744cb261d829abfdb6f2/downloads/road-haven-0.9.0-debug.apk.sha256) | 50,724,709 | `5cf3195a4005e129a7165e2f318391a1920052c9e8338c5276b72e8805a8ef31` |

## v0.24 보관

v0.10·v0.11 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 22개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.10 APK](https://raw.githubusercontent.com/h0623-dev/House/d78dcca4984f0aa38673f4a217be7ba89e86eb3a/downloads/road-haven-0.10.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/d78dcca4984f0aa38673f4a217be7ba89e86eb3a/downloads/road-haven-0.10.0-debug.apk.sha256) | 50,550,265 | `5fc52e48734c797aea1066ff5cf25a6442c71dd560fdc5732ddf6030c48b32e7` |
| [v0.11 APK](https://raw.githubusercontent.com/h0623-dev/House/d78dcca4984f0aa38673f4a217be7ba89e86eb3a/downloads/road-haven-0.11.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/d78dcca4984f0aa38673f4a217be7ba89e86eb3a/downloads/road-haven-0.11.0-debug.apk.sha256) | 54,660,886 | `ecabf550249957d424abf91b9e6d0376ec1c58e91f10d6190483e3005956d317` |

## v0.25 보관

v0.12·v0.13 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 23개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.12 APK](https://raw.githubusercontent.com/h0623-dev/House/ea5d67967de419d2a5f97896a9da1d4b58056b94/downloads/road-haven-0.12.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/ea5d67967de419d2a5f97896a9da1d4b58056b94/downloads/road-haven-0.12.0-debug.apk.sha256) | 54,573,068 | `7aab601e7a978504e41b807816db31b513529da5556eb3883c9cec029f00c9ec` |
| [v0.13 APK](https://raw.githubusercontent.com/h0623-dev/House/ea5d67967de419d2a5f97896a9da1d4b58056b94/downloads/road-haven-0.13.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/ea5d67967de419d2a5f97896a9da1d4b58056b94/downloads/road-haven-0.13.0-debug.apk.sha256) | 54,667,431 | `55a4cda0547f20856e5a36de411c996f51778f2baff351ae9675d3527d8005e4` |

## v0.26 보관

v0.14·v0.15 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 24개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.14 APK](https://raw.githubusercontent.com/h0623-dev/House/d14a1b64c5db85386af6e78fb690261a28f31010/downloads/road-haven-0.14.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/d14a1b64c5db85386af6e78fb690261a28f31010/downloads/road-haven-0.14.0-debug.apk.sha256) | 54,679,329 | `e32c61bb70bd0e45a2c339e4781bd94c94ac470e9fe93819d032d46668192b1d` |
| [v0.15 APK](https://raw.githubusercontent.com/h0623-dev/House/d14a1b64c5db85386af6e78fb690261a28f31010/downloads/road-haven-0.15.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/d14a1b64c5db85386af6e78fb690261a28f31010/downloads/road-haven-0.15.0-debug.apk.sha256) | 54,583,104 | `55fbce9daa6b283b3ad7bf6932c0ae5dbfab07dd1549d41469da3a285f5b8d4c` |

## v0.27 보관

v0.16·v0.17 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 25개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.16 APK](https://raw.githubusercontent.com/h0623-dev/House/fa169b7775417266de87235b93b157ffd2707695/downloads/road-haven-0.16.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/fa169b7775417266de87235b93b157ffd2707695/downloads/road-haven-0.16.0-debug.apk.sha256) | 56,284,760 | `e40aabf8acd6e875a771d1ace08bc7d0940bde462df1e5efb5fe53f1994cacb6` |
| [v0.17 APK](https://raw.githubusercontent.com/h0623-dev/House/fa169b7775417266de87235b93b157ffd2707695/downloads/road-haven-0.17.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/fa169b7775417266de87235b93b157ffd2707695/downloads/road-haven-0.17.0-debug.apk.sha256) | 57,878,580 | `958f51433caa24d452749fb0c4ded872840ff7fd1fe27adf7b4b1eb8823dbaa1` |

## v0.28 보관

v0.18·v0.19 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 26개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.18 APK](https://raw.githubusercontent.com/h0623-dev/House/ec8f2dcece0c21a7f7710b3d17476a2977941304/downloads/road-haven-0.18.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/ec8f2dcece0c21a7f7710b3d17476a2977941304/downloads/road-haven-0.18.0-debug.apk.sha256) | 61,175,402 | `363afc75a6775b0ce8527f25313a9ac401859ebf992f0c9838308aaf5d24dbb8` |
| [v0.19 APK](https://raw.githubusercontent.com/h0623-dev/House/ec8f2dcece0c21a7f7710b3d17476a2977941304/downloads/road-haven-0.19.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/ec8f2dcece0c21a7f7710b3d17476a2977941304/downloads/road-haven-0.19.0-debug.apk.sha256) | 61,059,005 | `e005a8af4881529bf54fff06a5cf48d579cf13094bb45057b12b2c1e84096931` |

## v0.29 보관

v0.20·v0.21 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 27개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.20 APK](https://raw.githubusercontent.com/h0623-dev/House/38a3f30c3c74a3d6bfa7c57fa77a7fc1a8491c73/downloads/road-haven-0.20.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/38a3f30c3c74a3d6bfa7c57fa77a7fc1a8491c73/downloads/road-haven-0.20.0-debug.apk.sha256) | 61,066,723 | `a522c28d38d439ca63add08731f4140070cfc1a6bbc362aa9b95d8e46de65e3d` |
| [v0.21 APK](https://raw.githubusercontent.com/h0623-dev/House/38a3f30c3c74a3d6bfa7c57fa77a7fc1a8491c73/downloads/road-haven-0.21.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/38a3f30c3c74a3d6bfa7c57fa77a7fc1a8491c73/downloads/road-haven-0.21.0-debug.apk.sha256) | 61,178,868 | `7a8c5ff90bc91879047dc8058b7c631a690f3a8ed15ca741f1c24fd3a59cc4e3` |

## v0.30 보관

v0.22·v0.23 APK 및 각 체크섬을 아래 이전 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 기존 게시 파일의 바이트 수와 SHA-256이 일치하는지 확인했습니다. Git 이력을 유지하며 과거 APK를 포함한 28개 릴리즈에 계속 접근할 수 있습니다. 현재 앱은 서명된 최신 game-update.json을 사용하며 아래 보관 주소를 자동 롤백 주소로 사용하지 않습니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.22 APK](https://raw.githubusercontent.com/h0623-dev/House/6acd285caafaeba42129a2b43ee1943b688cbaea/downloads/road-haven-0.22.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/6acd285caafaeba42129a2b43ee1943b688cbaea/downloads/road-haven-0.22.0-debug.apk.sha256) | 61,253,484 | `1ff494f78b10075f13584c11a9ea8dd7d4c8e1779b1a807a4954cbb204e50863` |
| [v0.23 APK](https://raw.githubusercontent.com/h0623-dev/House/6acd285caafaeba42129a2b43ee1943b688cbaea/downloads/road-haven-0.23.0-debug.apk) · [체크섬](https://raw.githubusercontent.com/h0623-dev/House/6acd285caafaeba42129a2b43ee1943b688cbaea/downloads/road-haven-0.23.0-debug.apk.sha256) | 61,103,969 | `f843984db9b110dc8f20adce4a9aa0c1b6e8fe097a9e3bf0688b49e894261c0a` |

## v0.31 보관

v0.24·v0.25 APK와 체크섬만 아래 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 바이트 수와 SHA-256 일치를 확인했습니다. 과거 콘텐츠·APK, 캐시된 자산과 Git 이력을 유지합니다. 아래 주소는 자동 롤백 대상이 아닙니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.24 APK](https://raw.githubusercontent.com/h0623-dev/House/7569da701cd53d294dc97abd7124759260083908/downloads/road-haven-0.24.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/7569da701cd53d294dc97abd7124759260083908/downloads/road-haven-0.24.0-debug.apk.sha256) | 61,106,167 | `729e7c3b5a37d8a608606d340dc926d9b4d497e4a89b4d02161e9824195670a0` |
| [v0.25 APK](https://raw.githubusercontent.com/h0623-dev/House/7569da701cd53d294dc97abd7124759260083908/downloads/road-haven-0.25.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/7569da701cd53d294dc97abd7124759260083908/downloads/road-haven-0.25.0-debug.apk.sha256) | 61,105,819 | `a21f72a1e6bf111eac4e1a281ff2bdd7a50b56f3ff4e896063c3082adaee19c8` |

## v0.32 보관

v0.26·v0.27 APK와 체크섬만 아래 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 바이트 수와 SHA-256 일치를 확인했습니다. 과거 콘텐츠·APK, 캐시된 자산과 Git 이력을 유지합니다. 아래 주소는 자동 롤백 대상이 아닙니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.26 APK](https://raw.githubusercontent.com/h0623-dev/House/589fc8a4dbc2325c375e3de7b7e63915a809a19c/downloads/road-haven-0.26.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/589fc8a4dbc2325c375e3de7b7e63915a809a19c/downloads/road-haven-0.26.0-debug.apk.sha256) | 61,119,345 | `f6b655c08ae61906b6683cd445a9a3ab0a0321ff1817cd90b8d00546bd6b9572` |
| [v0.27 APK](https://raw.githubusercontent.com/h0623-dev/House/589fc8a4dbc2325c375e3de7b7e63915a809a19c/downloads/road-haven-0.27.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/589fc8a4dbc2325c375e3de7b7e63915a809a19c/downloads/road-haven-0.27.0-debug.apk.sha256) | 61,134,699 | `b1b26fdc6800fe16250301755b5e28f5dd788720d64a2ff968ef9a1424e36647` |

## v0.33 보관

v0.28·v0.29 APK와 체크섬만 아래 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 바이트 수와 SHA-256 일치를 확인했습니다. 과거 콘텐츠·APK, 캐시된 자산과 Git 이력을 유지합니다. 아래 주소는 자동 롤백 대상이 아닙니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.28 APK](https://raw.githubusercontent.com/h0623-dev/House/6544b6fc5393381c1357d5370e6ab2267928e5a7/downloads/road-haven-0.28.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/6544b6fc5393381c1357d5370e6ab2267928e5a7/downloads/road-haven-0.28.0-debug.apk.sha256) | 61,142,471 | `b85c69effb96e37d8c539c69437dfa2066be1049d4307aacc7c76908e51cc4de` |
| [v0.29 APK](https://raw.githubusercontent.com/h0623-dev/House/6544b6fc5393381c1357d5370e6ab2267928e5a7/downloads/road-haven-0.29.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/6544b6fc5393381c1357d5370e6ab2267928e5a7/downloads/road-haven-0.29.0-debug.apk.sha256) | 61,144,088 | `2a16951e4a382fbd7031c52cc1856e9625c519646c1f42e53b28ea1bd833f4c6` |

## v0.34 보관

v0.30·v0.31 APK와 체크섬만 아래 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 바이트 수와 SHA-256 일치를 확인했습니다. 과거 콘텐츠·APK, 캐시된 자산과 Git 이력을 유지합니다. 아래 주소는 자동 롤백 대상이 아닙니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.30 APK](https://raw.githubusercontent.com/h0623-dev/House/6639893105711b960ad8978b34c7268164bf8c38/downloads/road-haven-0.30.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/6639893105711b960ad8978b34c7268164bf8c38/downloads/road-haven-0.30.0-debug.apk.sha256) | 61,147,409 | `7098820c86ca79a7acdf8498197c5201e7f2caf6132756c6f35df3ac8866d020` |
| [v0.31 APK](https://raw.githubusercontent.com/h0623-dev/House/6639893105711b960ad8978b34c7268164bf8c38/downloads/road-haven-0.31.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/6639893105711b960ad8978b34c7268164bf8c38/downloads/road-haven-0.31.0-debug.apk.sha256) | 61,150,806 | `d92b5282ce6584229b77bd1c0ca85e8080948245df9958e9ba5ce2c8c92fd8fa` |

## v0.35 보관

v0.32·v0.33 APK와 체크섬만 아래 공개 커밋의 고정 주소에 보관합니다. 정상 HTTPS로 전체 파일을 받아 바이트 수와 SHA-256 일치를 확인했습니다. 과거 콘텐츠·APK, 캐시된 자산과 Git 이력을 유지합니다. 아래 주소는 자동 롤백 대상이 아닙니다.

| 보관 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [v0.32 APK](https://raw.githubusercontent.com/h0623-dev/House/c8a2b0a9d88ebf05337ec8c6654602cd4fb68bd4/downloads/road-haven-0.32.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/c8a2b0a9d88ebf05337ec8c6654602cd4fb68bd4/downloads/road-haven-0.32.0-debug.apk.sha256) | 68,225,930 | `471c3157bbae01fce4e7632cdb64302d106145bec7ec3984eacfec8e008168e8` |
| [v0.33 APK](https://raw.githubusercontent.com/h0623-dev/House/c8a2b0a9d88ebf05337ec8c6654602cd4fb68bd4/downloads/road-haven-0.33.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/c8a2b0a9d88ebf05337ec8c6654602cd4fb68bd4/downloads/road-haven-0.33.0-debug.apk.sha256) | 68,227,737 | `4628c224187307083f8a3a76b436b607ea9b71aebe701c7946ba62af92ecc5de` |

## v0.36 보관

최신 트리의 v0.34·v0.35 APK와 체크섬은 이전 공개 커밋의 고정 주소로 보관합니다. 콘텐츠 ZIP·캐시 자산·Git 이력은 유지합니다. 아래 SHA-256은 해당 공개 커밋의 체크섬 파일에 기록된 값입니다.

| APK | 바이트 | SHA-256 | Git blob |
| --- | ---: | --- | --- |
| [v0.34 APK](https://raw.githubusercontent.com/h0623-dev/House/cf1539fec8f1d9eb1be1e12faab8df8c0ba66d0a/downloads/road-haven-0.34.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/cf1539fec8f1d9eb1be1e12faab8df8c0ba66d0a/downloads/road-haven-0.34.0-debug.apk.sha256) | 68,229,860 | `61a243e8e09ec22ef1a219012abe581a6613536e7876cceab63afce4285efbee` | `c684e4e2c03b03a457f4777d7dc54d6c8eb0c9c4` |
| [v0.35 APK](https://raw.githubusercontent.com/h0623-dev/House/cf1539fec8f1d9eb1be1e12faab8df8c0ba66d0a/downloads/road-haven-0.35.0-debug.apk) · [SHA-256](https://raw.githubusercontent.com/h0623-dev/House/cf1539fec8f1d9eb1be1e12faab8df8c0ba66d0a/downloads/road-haven-0.35.0-debug.apk.sha256) | 67,372,859 | `9ed2ee7f42be3a11587770d2ae2db33cdb7fb300df80bcdf0bb5a1bc77699db8` | `a16d9cb4bddc5d05e804c2158df03f3f93ebef93` |
