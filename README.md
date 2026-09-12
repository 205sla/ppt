# PPT 205

수업 중 직접 조작할 수 있는 정적 웹 슬라이드 저장소입니다. 빌드 도구나 외부 CDN 없이 HTML·CSS·JavaScript만 사용하므로 GitHub Pages에 바로 배포됩니다.

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

## 로컬 실행과 검증

```bash
npm run validate
npm run serve
```

브라우저에서 `http://127.0.0.1:4173/Ease/`를 엽니다. 파일을 직접 더블클릭하면 `decks.json` 목록 갱신은 제한될 수 있으므로 로컬 서버 사용을 권장합니다.

## 새 강의 추가

1. 영문 폴더를 하나 만들고 `index.html`, 강의별 CSS·JS·assets를 넣습니다.
2. 공용 발표 기능은 `shared/deck.css`와 `shared/deck.js`를 연결합니다.
3. `decks.json`에 폴더명(`slug`), 제목, 설명을 한 줄 추가합니다.
4. `npm run validate` 후 `main` 브랜치에 푸시하면 Pages가 자동 배포합니다.

## 이징 엔트리 작품 재생성과 검증

`Ease/source/entry/ease-lab-spec.mjs`는 여섯 단계의 공통 생성 원본입니다. 기본 명령은 기존 `.ent`를 덮어쓰지 않으므로 새 수업 버전은 파일 번호를 올려 관리합니다.

```powershell
npm run entry:build
npm run entry:verify
npm run entry:blocks
```

같은 번호의 파일을 의도적으로 다시 만들 때만 `node Ease/source/entry/build-ease-files.mjs --force`를 사용합니다. 세 스크립트는 `MYENTRY_ROOT` 환경 변수로 MYentry 저장소 위치를 바꿀 수 있습니다. 실행 검증과 블록 이미지 추출에는 `MYentry-game` 로컬 서버가 필요합니다.

## 배포 구조

`.github/workflows/pages.yml`이 저장소 전체를 GitHub Pages artifact로 올립니다. 별도의 프레임워크나 빌드 단계가 없어 새 강의 폴더를 추가해도 같은 방식으로 배포됩니다.

커스텀 도메인은 Actions 배포에서 `CNAME` 파일이 아니라 GitHub Pages 설정으로 관리합니다. GoDaddy에서 해야 할 마지막 DNS 작업은 [DOMAIN_SETUP.md](DOMAIN_SETUP.md)에 정리했습니다.
