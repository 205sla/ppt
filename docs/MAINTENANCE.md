# 구조와 운영

## 저장소 구조

```text
site.config.json          사이트 제목·주소·새 자료 기본값
decks.json                전체 목록과 초안/공개 상태의 원본
shared/                   발표 조작, 인쇄, 자료실, 공통 테마
templates/basic/          새 슬라이드를 생성하는 기본 틀
scripts/                  생성, 공개 상태, PDF, 검증, 배포 도구
scripts/lib/              공통 목록 검증과 로컬 서버
tests/                    생성부터 PDF·배포까지 통합 검증
docs/                     작성과 관리 안내
Ease/                     이징 수업 자료
  index.html
  styles.css
  deck.js
  assets/
  downloads/              Ease.pdf와 엔트리 실습 파일
  source/                 원본과 엔트리 전용 도구
<새 자료>/                모든 자료에 같은 구조 적용
_site/                    공개 자료만 담은 배포 결과 (Git 제외)
test-results/             검수 이미지와 임시 출력 (Git 제외)
```

## 변경 위치

| 변경할 내용 | 수정할 곳 |
| --- | --- |
| 사이트 주소, 이름, 기본 테마 | `site.config.json` |
| 자료 제목, 순서, 분류, 공개 상태 | `decks.json` |
| 모든 자료의 키보드·인쇄 동작 | `shared/deck.js`, `shared/deck.css` |
| 자료실 화면 | `index.html`, `shared/catalog.*` |
| 다음에 만들 슬라이드의 기본 틀 | `templates/basic/` |
| 특정 주제의 내용과 애니메이션 | 해당 자료 폴더 |
| 특정 자료의 특별한 검사 | 해당 자료의 `source/qa.mjs` |

기존 `Ease/` URL과 파일명은 유지합니다. 자료를 추가할 때 공통 CSS에 주제별 로고나 브랜드 색을 넣지 않습니다. `Ease/styles.css`처럼 개별 자료에서 공통 색상 변수를 재정의하세요.

## 배포 원칙

1. 등록 정보, 내부 링크, JavaScript를 확인합니다.
2. 공개 자료 전체의 최신 PDF를 생성합니다.
3. PDF와 슬라이드 페이지 수를 대조합니다.
4. 브라우저에서 자료실과 모든 공개 슬라이드를 확인합니다.
5. `_site/`만 GitHub Pages에 배포합니다.

하나라도 실패하면 배포하지 않아 기존 사이트가 유지됩니다. 초안, 템플릿, 테스트, 개발 도구, `source/`는 Pages 결과에 포함되지 않습니다. PDF 다운로드 링크는 목록과 슬라이드 HTML에 넣으므로 JavaScript 없이도 표시됩니다. 동적인 기능은 웹에서, 정적인 제출·보관은 PDF로 이용합니다.

Pull request에서는 검사와 배포 폴더 생성만 수행합니다. 실제 배포는 `main` 푸시나 수동 실행에만 연결됩니다. 실패한 검수 이미지는 Actions의 `slide-qa` artifact에서 확인할 수 있습니다.

## 버전과 복구

HTML·CSS·JS·이미지·최신 PDF를 같은 커밋으로 관리합니다. 배포용 PDF 이름은 항상 `<slug>.pdf`로 고정합니다. 과거 버전은 Git 이력에 남습니다. 엔트리 `.ent`처럼 별도 버전 번호를 사용하던 원본은 기존 정책을 유지합니다.

`_site/`, `node_modules/`, `test-results/`는 다시 만들 수 있는 생성물이므로 커밋하지 않습니다. 공개 내용을 되돌릴 때는 필요한 커밋을 `git revert`한 후 검증·재배포합니다. 사용자 작업이 있는 폴더에 `reset --hard`를 사용하지 않습니다.

로컬 관리 기준 폴더는 `C:\Users\young\prg\ai\1. 동적 슬라이드`입니다. 다른 작업에서 생성한 자료도 이 저장소의 새 폴더로 등록해 관리합니다. `AGENTS.md`에 같은 규칙을 기록해 다음 작업에서도 이어 사용할 수 있게 했습니다.

## 도메인

GitHub Pages의 커스텀 도메인과 DNS는 `DOMAIN_SETUP.md`를 참고합니다. `site.config.json`의 URL만 바꿔서는 DNS가 변경되지 않습니다. PDF의 웹 링크 주소는 이 설정을 사용하며, 임시 빌드에서는 `SITE_URL` 환경 변수로 대체할 수 있습니다.
