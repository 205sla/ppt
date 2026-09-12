# GoDaddy에서 `ppt.205.kr` 연결하기

GitHub 저장소와 Pages 배포 및 커스텀 도메인 설정이 완료된 뒤, GoDaddy DNS에서 아래 레코드만 추가합니다.

| 유형 | 이름(Host) | 값(Points to) | TTL |
|---|---|---|---|
| CNAME | `ppt` | `205sla.github.io` | 기본값 |

주의할 점:

- 값에 `https://`나 `/ppt`를 붙이지 않습니다.
- `ppt` 이름으로 이미 등록된 A, AAAA, CNAME 레코드가 있다면 충돌하지 않도록 정리합니다.
- DNS 반영에는 시간이 걸릴 수 있습니다. 반영 뒤 `https://ppt.205.kr/Ease/`로 접속합니다.
- GitHub Pages 화면에서 인증서가 준비되면 **Enforce HTTPS**를 켭니다.

공식 안내: [GitHub Pages 사용자 지정 도메인 관리](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
