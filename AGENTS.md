# 205 자료실 작업 규칙

이 저장소는 수업, 과제, 발표용 동적 HTML 슬라이드를 함께 관리합니다. 기본 관리 위치는 `C:\Users\young\prg\ai\1. 동적 슬라이드`, GitHub 저장소는 `205sla/ppt`입니다.

- 새 자료는 이 저장소에서 `npm.cmd run deck:new -- Folder --title "제목" --category "분류"`로 생성합니다. Windows PowerShell은 `npm.cmd`, 그 외 환경은 `npm`을 사용합니다. 폴더를 복사해 등록을 빠뜨리거나 자료마다 새 저장소를 만들지 않습니다.
- 사용하지 않는 슬라이드는 `_archive/<기존 폴더명>/`에 원본 전체를 보관합니다. `_archive/`는 Git 제외 폴더이며 공개 목록에서도 제거합니다. 기존 추적 파일은 Git 추적에서도 제거하고, 원래 등록 정보와 복구 방법을 함께 보관합니다. 보관 자료를 임의로 다시 등록하거나 배포하지 않습니다.
- `decks.json`은 목록과 공개 상태의 원본입니다. 사이트 주소와 기본값은 `site.config.json`에서 관리합니다. 기존 URL의 대소문자를 유지합니다.
- `shared/`는 공통 기능, `templates/basic/`은 새 자료의 기본 틀입니다. 주제별 콘텐츠·스타일·애니메이션·원본은 각 자료 폴더에 둡니다. 엔트리 전용 코드를 공통 스크립트에 넣지 않습니다.
- 초안은 `draft`로 만들고 작성 완료 후 `deck:publish`로 공개 대상으로 설정합니다. 템플릿의 안내 문구를 실제 내용으로 채운 뒤 해당 `data-template-placeholder` 속성을 제거합니다. 속성만 지워 미완성 내용을 공개하지 않습니다.
- 모든 공개 자료는 PDF를 함께 제공합니다. 배포 전에 항상 PDF를 새로 생성하고 페이지 수·한글·이미지·잘림을 확인합니다. 애니메이션은 `deck:prepareprint` 이벤트에서 설명하기 좋은 장면으로 고정합니다.
- 특정 폴더명이나 슬라이드 수를 공통 검증 코드에 하드코딩하지 않습니다. 자료 전용 브라우저 검사는 `<Folder>/source/qa.mjs`에 둡니다.
- 공통 기능 변경은 `npm test`, `npm run build`, `npm run qa`로 확인합니다. 한 자료 편집은 `npm run pdf -- Folder`, `npm run qa -- Folder`로 먼저 검수한 뒤 전체 빌드를 확인합니다.
- 웹과 PDF를 실제 렌더링해 확인합니다. `test-results/`와 `_site/`는 생성물이며 직접 원본처럼 편집하거나 커밋하지 않습니다. PDF는 `<Folder>/downloads/<Folder>.pdf`에 저장하고 소스와 함께 커밋합니다.
- 사용자가 요청한 배포 범위 안에서만 커밋·푸시합니다. 기존 사용자 변경을 보존하고, 공개 URL 변경이나 자료 삭제는 별도 요청 없이 하지 않습니다.

자세한 작성 절차는 `docs/AUTHORING.md`, 구조와 운영은 `docs/MAINTENANCE.md`를 따릅니다.
