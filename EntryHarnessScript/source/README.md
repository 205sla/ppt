# 엔트리 하네스 발표 촬영 대본

2026-10-19의 3차 발표 대본에서 실제 카메라 촬영 구간만 옮겼다. 한 문장이 한 슬라이드이며 문장 표현은 바꾸지 않았다.

| 구간 | 슬라이드 | 문장 수 |
| --- | --- | --- |
| S01 도입 | 1–4 | 4 |
| S08 다른 분야로의 확장 | 5–8 | 4 |
| S09 마무리 | 9–13 | 5 |

자료화면 내레이션과 설명용 시각자료는 포함하지 않는다. 구간별 촬영 배정 시간은 낭독 속도나 자동 전환 기준으로 사용하지 않는다.

## 사용

- 웹: <https://ppt.205.kr/EntryHarnessScript/>
- `←` / `→`, `Space`, `PageUp` / `PageDown`: 문장 이동
- `Home` / `End`: 처음 / 마지막 문장
- `F` 또는 전체 화면 버튼: 전체 화면 전환
- 위쪽 구간 버튼: 각 촬영 구간의 첫 문장
- `N`: 촬영 메모. 읽는 대사는 가운데 큰 글씨만 해당한다.

문장이 자동으로 넘어가지 않는다. 각 구간의 마지막 문장에서 촬영을 마친 뒤 다음 구간으로 이동한다.

## 수정과 검수

원고가 바뀌면 `source/script.json`을 갱신한 뒤 저장소 루트에서 실행한다.

```powershell
node EntryHarnessScript/source/author.mjs
npm.cmd run pdf -- EntryHarnessScript
npm.cmd run qa -- EntryHarnessScript
npm.cmd run build
```

`index.html`은 정적 HTML이므로 PDF와 웹이 같은 문장을 사용한다. `source/qa.mjs`는 문장 일치, 구간 이동 후 키보드 조작, 화면 크기별 읽기 영역, 전체 화면과 직접 링크를 확인한다.
