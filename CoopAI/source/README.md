# 인간–AI 협력 퍼즐 동적 슬라이드

15장. 작성일 2026-09-18. 사용자 요청에 따라 기존 205 자료실 템플릿으로 제작했다. 공식 API 동작과 팀의 내부 설계를 구분한다.

## 조작

- 좌우 방향키: 슬라이드 이동. F: 전체 화면. N: 발표자 노트.
- 재생·일시정지, 이전·다음 단계, 처음: 장면 진행.
- 게임 관찰/전체 상태, 명확/모호한 지시, 도움 제안 상황: 해당 버튼으로 비교.
- 병렬 처리 슬라이드: 계획 길이를 조절. 시간 단위는 설명용 가상 단계이며 실측이 아니다.
- 마이크·API 호출을 사용하지 않는 설명용 모의 재생이다.

## 검증된 공식 API 계약

문서 확인일: 2026-09-18. 기존 CapstoneDesign/LiveDemo의 세션 코드와 대조했으며 새 유료 API 호출은 하지 않았다.

1. 브라우저는 마이크 트랙, oai-events 데이터 채널, SDP offer를 준비한다.
2. 서버가 `POST /v1/live/sessions` 또는 SDK `client.live.create`를 사용한다. body는 `session`과 `transport: {type: "webrtc", sdp: 문자열}`이다.
3. 응답의 `session.id`, `transport.sdp`를 사용하고 브라우저가 answer를 적용한다. `session.started` 이후 앱 명령을 처리한다. WebRTC 세션에 `session.start`를 추가 송신하지 않는다.
4. 오디오 입출력은 WebRTC 미디어 트랙이다. 데이터 채널이나 sideband로 입력 PCM을 보내는 구조를 사용하지 않는다.
5. Node는 `wss://api.openai.com/v1/live/sessions/{session_id}/attach`로 같은 세션을 제어할 수 있다. API 키는 서버에서 사용한다.
6. client delegation에서는 앱이 백엔드 모델·기억·실행을 직접 운영한다. `session.delegation.created`는 지시문 없이 위임 메타데이터를 전달한다.
7. 전사 delta에는 확정된 사용자 발화 종료 이벤트가 없다. 전사 묶음은 수정 가능하게 관리하고 그 묶음·시간 간격만으로 행동을 실행하지 않는다.
8. `session.input`은 시작 시 텍스트 이력이다. 실행 중 상태 문맥은 `session.thinking.append`, 발화할 결과는 `session.commentary.append`, 앱 지침은 `session.instructions.append`로 전달한다.
9. 위 세 append의 `content`는 최대 500토큰의 문자열이다. `delegation_id`는 실제 위임 ID 또는 일반 문맥의 null이다. 위임 ID를 앱이 임의로 만들지 않는다. 슬라이드의 item_demo는 예시 ID다.
10. append ACK는 추정 문맥 주입 확인이며 모델이 업데이트를 전부 반영했거나 음성이 재생됐거나 게임 행동이 완료됐다는 증거가 아니다.

## 근거

- OpenAI GPT-Live WebRTC: https://developers.openai.com/api/docs/guides/voice-webrtc?api=live
- Live 세션·문맥·전사: https://developers.openai.com/api/docs/guides/live-conversations
- Live 위임과 결과: https://developers.openai.com/api/docs/guides/live-delegation
- sideband 서버 제어: https://developers.openai.com/api/docs/guides/voice-server-controls?api=live
- LM Studio Structured Output: https://lmstudio.ai/docs/developer/openai-compat/structured-output
- HLA 저자 프로젝트: https://sites.google.com/view/overcooked-hla/
- HLA 공식 코드: https://github.com/HosnLS/Hierarchical-Language-Agent
- HLA 원문: https://arxiv.org/abs/2312.15224

assets/hla-framework.png는 기존 조사에서 보관한 HLA Figure 2 캡처다. 원 그림 속 모델·속도 수치는 논문의 구성으로, 우리 측정값이 아니다.

언리얼→Node의 게임 JSON, task_epoch, operation_id, 행동 목록, 취소·동기화·제안 조건은 우리 시스템의 설계 예시다. 빠른/느린 판단 모델과 실명별 역할은 미확정이다. 학생 연락처·학번·API 키는 포함하지 않는다.

## 운영

주제별 코드는 index.html, styles.css, deck.js에 있다. source/qa.mjs는 기존 공통 QA에서 실행하는 자료 전용 검사다. source/는 GitHub Pages에서 제외된다. PDF는 deck:prepareprint에서 대표 장면으로 고정한 후 저장한다. 공개 소스와 PDF를 함께 커밋하고 main 배포를 확인한다.
