# 새 슬라이드 작성

## 생성

저장소 루트에서 실행합니다. Windows PowerShell에서는 옵션 전달 문제를 피하도록 `npm.cmd`를 사용하고, macOS/Linux에서는 `npm`으로 바꿉니다.

```powershell
npm.cmd run deck:new -- Report --title "발표 제목" --category "과제"
npm run serve
```

`http://127.0.0.1:4173/Report/`에서 확인합니다. 기본 밝은 테마를 사용하며 `--theme dark`로 어두운 테마를 선택할 수 있습니다. 표지, 핵심 내용, 비교, 정리의 4장으로 시작합니다. 필요한 슬라이드만 남기거나 복제해 사용하세요.

생성 명령은 `index.html`, `styles.css`, `deck.js`, `assets/`, `downloads/`, `source/`를 만들고 `decks.json`에 초안으로 등록합니다. 같은 이름의 폴더가 있으면 덮어쓰지 않습니다. Windows와 GitHub Pages 간 혼동을 막기 위해 대소문자만 다른 이름도 허용하지 않습니다.

## 내용과 자료

- `index.html`: 제목, 설명, 그림, 표, 발표자 노트
- `styles.css`: 해당 자료의 레이아웃과 색상
- `deck.js`: 해당 자료의 애니메이션과 버튼
- `assets/`: 화면에서 사용하는 이미지, 영상, 자체 호스팅 글꼴
- `downloads/`: PDF와 청중이 받는 실습 파일
- `source/`: 원본, 생성 도구, 자료 전용 검증 코드. Pages 배포에서 제외됩니다.

템플릿에서 안내하는 부분을 실제 내용으로 바꾸고 해당 요소의 `data-template-placeholder` 속성을 제거합니다. 표시가 남아 있으면 공개 대상으로 전환할 수 없습니다. 화면에 필요한 이미지는 `assets/`에 넣고 상대 경로를 사용하세요. 이미지에는 `alt`를 적고 원본 비율을 유지합니다.

각 `.slide`는 16:9 한 페이지입니다. 스크립트가 실제 슬라이드 수를 계산하므로 페이지 수를 따로 수정할 필요가 없습니다. 한 슬라이드에는 한 가지 주제를 담고, 글자 크기를 줄이기 전에 내용을 나누세요. 발표자 노트는 `.speaker-notes` 안에 적습니다.

## 메인 화면의 정보

`decks.json`의 해당 항목을 수정합니다. 배열에 적힌 순서대로 표시됩니다.

```json
{
  "slug": "Report",
  "title": "발표 제목",
  "status": "draft",
  "category": "과제",
  "date": "2026-09-12",
  "description": "자료의 주제를 한 문장으로 설명합니다.",
  "meta": "과목명 · 작성자"
}
```

`slug`는 공개 주소이므로 공개 후에는 유지합니다. `category`는 발표, 과제, 수업 외에도 자유롭게 정할 수 있습니다. 분류가 두 가지 이상이면 메인에 필터가 나타납니다. `date`는 게시 기준일이고 형식은 YYYY-MM-DD입니다.

## 애니메이션과 PDF

화면 전환과 PDF 준비 이벤트를 이용합니다.

```javascript
window.addEventListener('deck:slidechange', ({ detail }) => {
    // detail.slide: 현재 슬라이드
    // detail.previousSlide: 이전 슬라이드
    // 이전 슬라이드의 타이머와 애니메이션을 멈춥니다.
});

window.addEventListener('deck:prepareprint', () => {
    // 타이머와 requestAnimationFrame을 멈춥니다.
    // 비교가 가능한 대표 장면으로 위치, 그래프, 수치를 맞춥니다.
});
```

PDF 준비 처리는 동기적으로 수행하고 여러 번 호출해도 같은 결과가 나오게 작성합니다. 자동 재생을 예약했다면 인쇄 모드에서는 실행하지 않도록 확인합니다. 인쇄 준비는 글꼴과 이미지가 로딩된 후에도 다시 호출됩니다.

## 검수와 공개

```powershell
npm run pdf -- Report
npm run qa -- Report
npm run deck:publish -- Report
npm run build
npm run preview
```

초안도 폴더명을 지정하면 PDF와 브라우저 검수를 실행할 수 있습니다. PDF는 `Report/downloads/Report.pdf`, 화면 검수 이미지는 `test-results/Report/`에 생성됩니다. PDF를 열어 한글과 잘림, 페이지 수를 직접 확인하세요.

`deck:publish`는 로컬 목록에서 공개 대상으로 표시하는 명령입니다. 소스와 PDF를 함께 커밋하고 `main`에 푸시하면 GitHub에서 전체 검증과 PDF 생성을 거쳐 배포합니다. `npm run preview`는 실제 배포 폴더 `_site/`를 열므로 초안 제외 여부와 다운로드 버튼도 확인할 수 있습니다.

`npm run deck:draft -- Report`로 다시 초안 상태로 바꿀 수 있습니다. 다음 배포부터 목록과 Pages 폴더에서 빠집니다. 이미 공개한 자료의 주소를 중단할 때는 기존 링크의 사용 여부를 먼저 확인하세요.

초안 상태는 Pages 배포 여부만 제어합니다. GitHub 저장소가 공개라면 커밋된 소스는 저장소에서 볼 수 있습니다.

## 자료 전용 검사

필요한 자료에만 `source/qa.mjs`를 추가하면 공통 브라우저 검수가 함께 실행합니다.

```javascript
export default async function verify({ page, baseUrl, deck }) {
    // Playwright의 page로 해당 자료의 버튼, 퀴즈, 파일 링크를 확인합니다.
}
```

이징 자료의 구현 예시는 `Ease/source/qa.mjs`입니다. 공통 기능을 변경했다면 밝은 테마와 어두운 테마, 다른 페이지 수를 함께 확인하는 `npm test`도 실행하세요.
