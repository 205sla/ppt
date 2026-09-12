# 205 자료실

발표, 과제 제출, 수업 자료를 함께 관리하는 정적 웹사이트입니다. 각 자료를 웹으로 열거나 PDF로 내려받을 수 있습니다. 사이트는 HTML·CSS·JavaScript로 동작하고, 배포할 때 Chromium으로 모든 슬라이드의 PDF를 새로 생성합니다.

## 현재 슬라이드

- `Ease/` — 중학교 1학년 엔트리 수업용 **이징 함수로 움직임 만들기** (22장, 약 90분)
- `t×100`부터 시작해 좌표 범위, 이동 함수, 네 가지 이징으로 이어지는 단계식 구성
- 실제 실행 검증을 마친 단계별 `.ent` 6개와 각 작품에서 추출한 엔트리 블록 PNG 포함
- 경로: `https://ppt.205.kr/Ease/` (DNS 연결 전: `https://205sla.github.io/ppt/Ease/`)

## 발표 조작

- `←` / `→`, `PageUp` / `PageDown`: 이동
- `Home` / `End`: 처음 / 마지막
- `F`: 전체 화면
- `N`: 발표자 노트
- `?print=1`: 인쇄·PDF용 전체 슬라이드 보기
- 휴대전화·태블릿: 좌우 스와이프
- 우측 상단 `PDF 다운로드`: 미리 생성한 전체 슬라이드 PDF 받기 (전체 화면 발표 중에는 숨김)

## 로컬 실행과 검증

```bash
npm ci
npx playwright install chromium
npm run build
npm run serve
```

브라우저에서 `http://127.0.0.1:4173/Ease/`를 엽니다. 파일을 직접 더블클릭하면 `decks.json` 목록 갱신은 제한될 수 있으므로 로컬 서버 사용을 권장합니다.

`npm run pdf`는 모든 자료의 PDF를 생성합니다. `npm run build`는 PDF 생성, 내부 링크 검증, `_site/` 배포 폴더 생성을 차례로 실행합니다. `npm run qa`는 자료실과 슬라이드를 실제 브라우저에서 확인합니다.

PDF는 각 폴더의 `downloads/폴더명.pdf`에 저장됩니다. 예: `Ease/downloads/Ease.pdf`. 한 슬라이드가 16:9 PDF 한 페이지에 대응하며, 글자와 링크를 유지합니다. 애니메이션은 비교하기 쉬운 중간 장면으로 고정하고 조작 기능은 웹에서 이용합니다. PDF 생성이 실패하거나 페이지 수가 맞지 않으면 배포를 중단하여 기존 사이트를 유지합니다.

## 새 자료 추가

1. 영문 폴더를 하나 만들고 `index.html`, 자료별 CSS·JS·assets를 넣습니다. 폴더명은 영문·숫자·하이픈·밑줄만 사용합니다.
2. 공용 발표 기능은 `shared/deck.css`와 `shared/deck.js`를 연결합니다.
3. `decks.json`에 폴더명(`slug`), 제목(`title`), 분류(`category`), 날짜(`date`), 설명(`description`), 짧은 정보(`meta`)를 추가합니다. 분류는 `발표`, `과제`, `수업` 등 자유롭게 정할 수 있고, 분류가 둘 이상이면 메인 화면에 필터가 나타납니다.
4. 배포할 때 모든 자료의 우측 상단에 PDF 다운로드 버튼을 자동으로 추가합니다. 로컬 미리보기에도 표시하려면 `index.html`에 `<a class="deck-download" href="downloads/Essay.pdf" download>PDF 다운로드 ↓</a>`를 넣습니다.
5. `npm run build` 후 PDF를 열어 확인하고, 생성된 PDF와 소스를 함께 커밋하여 `main`에 푸시합니다. Pages에서도 전체 PDF를 다시 생성해 최신 내용으로 배포합니다.

```json
{
  "slug": "Essay",
  "title": "과제 제목",
  "category": "과제",
  "date": "2026-09-12",
  "description": "과제의 주제와 내용을 짧게 설명합니다.",
  "meta": "과목명 · 작성자"
}
```

위 항목은 등록 형식 예시입니다. 실제 폴더와 슬라이드를 만든 뒤 목록에 추가하세요. 자료실 목록과 PDF 링크는 배포 시 HTML에도 기록하므로 JavaScript가 작동하지 않아도 접근할 수 있습니다.

동적 슬라이드는 필요하면 `deck:prepareprint` 이벤트에서 PDF용 장면을 설정할 수 있습니다. 일반 슬라이드는 별도 처리 없이 내보냅니다. 페이지 내 슬라이드는 `[data-deck]` 안의 `.slide`로 구성합니다.

## 이징 엔트리 작품 재생성과 검증

`Ease/source/entry/ease-lab-spec.mjs`는 여섯 단계의 공통 생성 원본입니다. 기본 명령은 기존 `.ent`를 덮어쓰지 않으므로 새 수업 버전은 파일 번호를 올려 관리합니다.

```powershell
npm run entry:build
npm run entry:verify
npm run entry:blocks
```

같은 번호의 파일을 의도적으로 다시 만들 때만 `node Ease/source/entry/build-ease-files.mjs --force`를 사용합니다. 세 스크립트는 `MYENTRY_ROOT` 환경 변수로 MYentry 저장소 위치를 바꿀 수 있습니다. 실행 검증과 블록 이미지 추출에는 `MYentry-game` 로컬 서버가 필요합니다.

## 배포 구조

`.github/workflows/pages.yml`은 Node와 Chromium, 한글 글꼴을 설치하고 `npm run build`를 실행한 뒤 `_site/`만 GitHub Pages에 올립니다. 소스 생성 도구, 의존성, 검수 이미지는 공개 배포물에서 제외합니다. PDF의 링크 주소는 기본 `https://ppt.205.kr/`이며, 다른 도메인에서는 빌드 시 `SITE_URL` 환경 변수로 변경할 수 있습니다.

커스텀 도메인은 Actions 배포에서 `CNAME` 파일이 아니라 GitHub Pages 설정으로 관리합니다. GoDaddy에서 해야 할 마지막 DNS 작업은 [DOMAIN_SETUP.md](DOMAIN_SETUP.md)에 정리했습니다.
