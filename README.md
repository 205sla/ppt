# 205 자료실

발표, 과제, 수업 자료를 한 저장소에서 관리합니다. 자료마다 웹 슬라이드와 PDF를 함께 제공하며, 새 자료는 공통 템플릿으로 시작합니다.

- 관리 폴더: `C:\Users\young\prg\ai\1. 동적 슬라이드`
- 사이트: [ppt.205.kr](http://ppt.205.kr/)
- GitHub: [205sla/ppt](https://github.com/205sla/ppt)
- 현재 자료: [이징 함수로 움직임 만들기](http://ppt.205.kr/Ease/) (중학교 1학년, 22장)

## 새 슬라이드 만들기

```powershell
npm.cmd run deck:new -- Report --title "발표 제목" --category "과제"
npm run serve
```

Windows PowerShell에서는 옵션이 정확히 전달되도록 생성 명령에 `npm.cmd`를 사용합니다. macOS/Linux에서는 `npm`을 사용합니다.

`http://127.0.0.1:4173/Report/`에서 확인합니다. 기본 밝은 테마 대신 어두운 테마를 쓰려면 `--theme dark`를 추가합니다.

`Report/index.html`에 내용을 작성하고 `decks.json`에서 설명, 날짜, 분류를 정리합니다. 새 자료는 초안으로 등록되며 공개 목록과 Pages에서 제외됩니다. 템플릿 안내 문구를 실제 내용으로 바꾼 뒤 해당 `data-template-placeholder` 속성을 제거하세요.

```powershell
npm run pdf -- Report
npm run qa -- Report
npm run deck:publish -- Report
npm run build
npm run preview
```

PDF는 `Report/downloads/Report.pdf`에 생성됩니다. 웹과 PDF를 확인한 뒤 변경 파일을 함께 커밋하고 `main`에 푸시합니다. GitHub에서도 공개 자료 전체의 PDF를 새로 만들고 검증한 뒤 배포합니다.

## 자주 쓰는 명령

| 명령 | 동작 |
| --- | --- |
| `npm run deck:list` | 전체 자료와 초안/공개 상태 |
| `npm.cmd run deck:new -- Folder --title "제목"` | 새 자료 생성과 초안 등록 (Windows) |
| `npm run deck:publish -- Folder` | 작성 완료 검사 후 공개 대상으로 설정 |
| `npm run deck:draft -- Folder` | 다음 배포부터 초안으로 제외 |
| `npm run pdf -- Folder` | 한 자료의 PDF 생성 (초안도 가능) |
| `npm run qa -- Folder` | 한 자료의 브라우저 검수 |
| `npm run validate` | 공개 자료의 소스와 링크 검증 |
| `npm test` | 생성·초안 제외·테마·PDF·배포 통합 검증 |
| `npm run build` | 전체 검증, PDF 생성, 배포 폴더 생성 |
| `npm run qa` | 자료실과 모든 공개 슬라이드 검수 |
| `npm run serve` | 작업 폴더 미리보기 |
| `npm run preview` | 실제 배포 결과 미리보기 |

폴더명을 생략한 PDF·검수 명령은 공개 자료 전체에 적용됩니다. 사이트 이름·주소·기본 테마는 `site.config.json`, 자료 목록·순서·공개 상태는 `decks.json` 한 곳에서 관리합니다.

## 처음 사용하는 컴퓨터

Node.js 22 이상과 Git을 준비한 뒤 실행합니다.

```powershell
npm ci
npx playwright install chromium
npm run build
npm run serve
```

방향키로 이동하고 `F`로 전체 화면, `N`으로 발표자 노트를 엽니다. PDF 다운로드 버튼은 각 자료의 우측 상단과 메인 목록에 있습니다. `?print=1`로 전체 페이지를 펼쳐 볼 수 있습니다.

## 안내 문서

- [작성 안내](docs/AUTHORING.md): 템플릿, 콘텐츠, 애니메이션, PDF, 검수, 공개
- [구조와 운영](docs/MAINTENANCE.md): 폴더별 역할, 배포, 버전과 복구
- [작업 규칙](AGENTS.md): 이후 작업에서도 유지할 공통 원칙
- [도메인 연결](DOMAIN_SETUP.md): GitHub Pages와 GoDaddy 설정

## 엔트리 수업 전용 도구

공통 슬라이드 도구와 분리해 `Ease/source/`에서 관리합니다.

```powershell
npm run entry:build
npm run entry:verify
npm run entry:blocks
```

MYentry-game 경로는 `MYENTRY_ROOT`로 지정할 수 있습니다. 실행 검증과 블록 이미지 추출에는 MYentry 로컬 서버가 필요합니다. 기존 번호의 `.ent`를 다시 만드는 작업에는 원래의 `--force` 규칙을 유지합니다.
