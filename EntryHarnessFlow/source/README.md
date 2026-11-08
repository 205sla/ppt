# EntryHarnessFlow 원본과 도구

엔트리 바이브코딩 부스 상영 영상(2026-11-07)의 요청·역할 나누기·6단계 하네스·실제 제작 기록 부분을, 발표자가 직접 넘기며 설명하는 웹 슬라이드로 다시 구성한 자료입니다. 영상의 완성 작품(게임 플레이)과 편집기 장면은 넣지 않았습니다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `../index.html` | 12장 슬라이드와 발표자 노트. 장면 단계는 `data-scene`·`data-steps`, 단계별로 보일 요소는 `data-show` |
| `../deck.js` | 현재 장의 단계 자동 재생(4초 간격)·스페이스/방향키 페이지 이동·단계 버튼·인쇄 상태 |
| `../styles.css` | 자료 전용 배치와 움직임(CSS만 사용) |
| `../assets/fonts/` | EHF Sans(Pretendard 수정본) WOFF 3종과 OFL 전문 |
| `subset-fonts.py` | 글꼴 다시 만들기 |
| `font-glyphs.json` | 글꼴에 든 글자 목록. `qa.mjs`가 화면 글자와 대조 |
| `qa.mjs` | 자료 전용 브라우저 검사(`npm run qa -- EntryHarnessFlow`가 함께 실행) |
| `preview.mjs` | 모든 장·단계를 캡처해 눈으로 확인 |
| `COMPLETION.md` | 구성·조작법·검사 결과·제한 |

## `data-show` 규칙

- `"2"`: 2단계부터 보임 (2단계에서 `is-now`)
- `"=2"`: 2단계에서만 보임
- `"<=1"`: 1단계까지만 보임

단계 번호는 0부터 셉니다. 단계 이름은 슬라이드의 `data-steps`에 `|`로 나눠 적고, 마지막 단계가 PDF에 실리는 완성 장면입니다. 장에 들어오면 처음부터 4초 간격으로 재생하고 마지막 단계에서 멈춥니다. 뒤로 돌아와도 처음부터 재생합니다. 페이지는 스페이스·→·↓로 다음 장, ←·↑·Shift+스페이스로 이전 장을 엽니다. 버튼은 클릭이나 Enter로 조작합니다. 단계 버튼을 누르면 그 단계부터 자동 재생을 이어 갑니다. 숨긴 탭과 인쇄 중에는 자동 재생을 멈추며, 움직임 줄이기 설정에서는 완성 장면을 바로 표시합니다.

## 문구를 고친 뒤

```bash
python EntryHarnessFlow/source/subset-fonts.py <Pretendard TTF 폴더>   # 자료 폴더 기준 경로로 실행해도 됩니다
npm run pdf -- EntryHarnessFlow
npm run qa -- EntryHarnessFlow
node EntryHarnessFlow/source/preview.mjs 1920 1080              # 선택: test-results/EntryHarnessFlow-steps/
```

글꼴 폴더에는 Pretendard-Medium/Bold/ExtraBold.ttf와 OFL_Pretendard.txt가 있어야 합니다. Pretendard는 예약 글꼴 이름이 있는 OFL 글꼴이므로 글자를 줄인 수정본은 EHF Sans로 이름을 바꿔 둡니다.

## 사실 근거

- 실제 요청 원문·작업 기록 요약: 2026-09-23 제작 녹화(부스 영상 작업에서 확인한 프레임). 작업 기록은 영어 원문을 우리말로 요약했고 원문·녹화 화면은 넣지 않았습니다.
- 명세 10줄: SUNSET DRIVE `games/sunset-drive/spec.mjs` 281–290행.
- 정적 검사: `make-ent.mjs`의 `validateSpec`(블록 목록 474종), 생성 명령도 오류가 있으면 `.ent`를 만들지 않음.
- 실행·관찰: `play-check.mjs` 머리말(그대로 2초, 키마다 0.6초 비교, 가려진 오브젝트·무대 밖 글상자, 화면 캡처, 규칙 판정 안 함).
- 66/66과 표의 값: 2026-09-23 보관 검사 기록(`sunset-drive_002.ent`, 로컬 Entry 4.0.20, 헤드리스 Chromium). 이 자료를 만들며 새로 검사하지 않았습니다.
- 공개 엔트리 엔진 라이선스: 하네스 저장소 NOTICE(`@entrylabs/entry` Apache-2.0).
