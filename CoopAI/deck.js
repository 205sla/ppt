(() => {
  'use strict';
  const $ = (root, selector) => root.querySelector(selector);
  const $$ = (root, selector) => [...root.querySelectorAll(selector)];
  const text = (root, selector, value) => { const el = $(root, selector); if (el) el.textContent = value; };
  const json = (value) => JSON.stringify(value, null, 2);
  const demos = new Map();
  const choices = { context: 'state', observation: 'known', request: 'clear', initiative: 'stuck', duration: 6 };
  let printing = false;
  let savedPrintState = null;
  let ready = false;

  class Sequence {
    constructor(name, frames, render, printIndex = frames.length - 1) {
      this.name = name; this.root = document.querySelector(`[data-demo="${name}"]`);
      this.frames = frames; this.renderFrame = render; this.index = 0; this.timer = null; this.printIndex = printIndex;
      const controls = $(this.root, '[data-controls]');
      if (controls) {
        controls.innerHTML = '<button type="button" class="button primary" data-play aria-label="애니메이션 재생">재생</button><button type="button" class="button" data-step-back aria-label="이전 단계">이전 단계</button><span class="step-number" data-step-number></span><button type="button" class="button" data-step aria-label="다음 단계">다음 단계</button><button type="button" class="button" data-reset>처음</button>';
        $(controls, '[data-play]').addEventListener('click', () => this.toggle());
        $(controls, '[data-step-back]').addEventListener('click', () => { this.pause(); this.set(this.index - 1); });
        $(controls, '[data-step]').addEventListener('click', () => { this.pause(); this.set(this.index + 1); });
        $(controls, '[data-reset]').addEventListener('click', () => { this.pause(); this.set(0); });
      }
      demos.set(name, this); this.set(0);
    }
    set(index) {
      this.index = Math.max(0, Math.min(index, this.frames.length - 1));
      this.root.dataset.frame = this.index;
      this.renderFrame(this.root, this.frames[this.index], this.index);
      text(this.root, '[data-caption]', this.frames[this.index].caption || '');
      text(this.root, '[data-step-number]', `${this.index + 1} / ${this.frames.length}`);
      const back = $(this.root, '[data-step-back]'); if (back) back.disabled = this.index === 0;
      const next = $(this.root, '[data-step]'); if (next) next.disabled = this.index === this.frames.length - 1;
      if (this.index === this.frames.length - 1) this.pause();
    }
    pause() {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null; this.root.dataset.playing = 'false';
      const play = $(this.root, '[data-play]'); if (play) { play.textContent = '재생'; play.setAttribute('aria-label', '애니메이션 재생'); }
    }
    toggle() {
      if (printing) return;
      if (this.timer !== null) { this.pause(); return; }
      if (this.index === this.frames.length - 1) this.set(0);
      text(this.root, '[data-play]', '일시정지'); $(this.root, '[data-play]')?.setAttribute('aria-label', '애니메이션 일시정지');
      this.root.dataset.playing = 'true';
      this.timer = setInterval(() => this.set(this.index + 1), this.name === 'parallel' ? 650 : 1600);
    }
  }

  function scene(root) {
    root.innerHTML = '<div class="grid-item plate blue" style="--x:4;--y:2"><span>파랑</span></div><div class="grid-item plate yellow" style="--x:3;--y:4"><span>노랑</span></div><div class="grid-item door"><span>문</span></div><div class="grid-item lever" style="--x:8;--y:1">레버</div><div class="grid-item npc" style="--x:1;--y:2">AI</div><div class="grid-item person" style="--x:5;--y:1">사람</div><div class="fog">미관찰 영역</div><div class="map-legend">AI · 사람 · 발판 · 문</div>';
  }
  function selectButtons(root, selector, field, value) {
    $$(root, selector).forEach(button => button.setAttribute('aria-pressed', String(button.dataset[field] === value)));
  }

  const contextData = {
    state: { route: '언리얼 → Node → 판단 모델', title: '구조화된 게임 상태', explain: '전체 게임에서 AI가 아는 정보만 추려 다음 행동을 선택하게 한다.', limit: '우리 팀의 내부 JSON 명세', code: '{\n  "task_epoch": 7,\n  "observation_revision": 42,\n  "agent_cell": [2, 1, 0],\n  "known_objects": [\n    "plate_blue", "plate_yellow"\n  ],\n  "available_actions": [\n    "hold_blue", "hold_yellow",\n    "ask_player"\n  ]\n}' },
    delegation: { route: 'GPT-Live → Node 서버', title: '작업 위임은 신호와 ID', explain: '지시문은 앱이 모은 전사와 현재 작업에서 구성한다. 위임 이벤트 자체에는 지시문이 없다.', limit: '전사와 위임을 연결하는 코드 필요', code: json({ type: 'session.delegation.created', event_id: 'event_demo', offset_ms: 1000, delegation: { id: 'item_demo', type: 'delegation', target: 'client' } }) },
    quiet: { route: 'Node → GPT-Live', title: '말없이 상태 문맥 추가', explain: '게임 판단에 쓰는 큰 JSON은 백엔드에 보관하고, 대화에 필요한 상태만 짧게 전달한다.', limit: 'content: 문자열 · append당 최대 500토큰', code: json({ type: 'session.thinking.append', event_id: 'context_42', delegation_id: null, content: 'AI는 파란 발판으로 이동 중이다. 아직 발판을 밟지 않았다.' }) },
    speak: { route: '언리얼 결과 → Node → GPT-Live', title: '확인된 결과를 말하기', explain: '엔진이 발판 접촉을 확인한 뒤 진행 상황을 음성으로 안내하도록 전달한다.', limit: '실제 받은 delegation.id 유지 · ACK와 재생은 별개', code: json({ type: 'session.commentary.append', event_id: 'result_42', delegation_id: 'item_demo', content: '파란 발판 접촉 확인. 유지 중이며 플레이어 통과 확인을 기다린다.' }) },
    print: { route: '게임 JSON → 판단 / 짧은 문맥 → Live', title: '서로 다른 입력 계약', explain: '위임 ID와 전사는 앱에서 연결한다. 엔진 결과를 받은 뒤 대화에 반영한다.', limit: 'append content는 문자열, 최대 500토큰. 위임 ID 또는 null을 지정.', code: '판단 백엔드 ← 게임 JSON\n{ task_epoch, known_objects,\n  available_actions }\n\nGPT-Live ← 상태 요약\nsession.thinking.append\ncontent: "발판으로 이동 중"\n\nGPT-Live ← 확인된 결과\nsession.commentary.append\ncontent: "발판 유지 중"\n\n작업 위임 → ID·target·offset\n지시문은 전사·작업에서 구성' }
  };
  function renderContext() {
    const root = document.querySelector('[data-demo="context"]'); const data = contextData[choices.context];
    selectButtons(root, '[data-context]', 'context', choices.context);
    for (const key of ['route', 'title', 'explain', 'limit', 'code']) text(root, `[data-context-${key}]`, data[key]);
  }
  function renderObservation() {
    const root = document.querySelector('[data-demo="observe"]'); const world = choices.observation === 'world';
    selectButtons(root, '[data-observation]', 'observation', choices.observation);
    $(root, '[data-scene]').classList.toggle('world-visible', world);
    text(root, '[data-observation-label]', 'AI에 전달되는 JSON · 관찰 범위 유지');
    text(root, '[data-observation-json]', '{\n  "agent_cell": [1, 2, 0],\n  "known_objects": [\n    "plate_blue", "plate_yellow",\n    "door"\n  ],\n  "shared_fact": {\n    "claim": "파란 발판이 문을 연다",\n    "source": "player",\n    "verified": false\n  }\n}');
    text(root, '[data-observation-caption]', world ? '전체 상태를 확인해도 AI 입력에는 보이지 않는 레버를 추가하지 않는다.' : '보이지 않는 레버의 존재와 정답을 자동으로 알려주지 않는다.');
  }
  function renderDecision() {
    const root = document.querySelector('[data-demo="decision"]'); const ambiguous = choices.request === 'ambiguous';
    selectButtons(root, '[data-request]', 'request', choices.request);
    text(root, '[data-request-text]', ambiguous ? '“그 발판을 밟아줘.”' : '“내가 문을 통과할 때까지 파란 발판을 밟고 있어.”');
    $$(root, '[data-action]').forEach(el => el.classList.toggle('selected', el.dataset.action === (ambiguous ? 'ask_player' : 'hold_blue')));
    text(root, '[data-decision-output]', ambiguous ? json({ kind: 'ask', action_id: 'ask_player', question: '파란 발판과 노란 발판 중 어느 쪽이야?' }) : '{\n  "kind": "action",\n  "action_id": "hold_blue",\n  "release_on":\n    "통과 관찰 또는 확인"\n}');
  }
  function renderInitiative() {
    const root = document.querySelector('[data-demo="initiative"]'); const mode = choices.initiative;
    selectButtons(root, '[data-initiative]', 'initiative', mode);
    const data = mode === 'stuck' ? { events: ['이동 경로 차단', '같은 행동 반복 실패', '새로운 진행 없음'], gate: '계획 요청', reason: '막힘 감지 · 제안 가능', speech: '“내가 발판을 유지할 테니, 반대편 장치를 확인해볼래?”' } : mode === 'holding' ? { events: ['발판 접촉 유지', '플레이어 통과 대기', '현재 약속 수행 중'], gate: '행동 유지', reason: '정상적인 대기', speech: '발판을 계속 밟으며 기다린다.' } : { events: ['해결 방법 후보 있음', '플레이어가 설명 중', '새 정보 수신 중'], gate: '제안 보류', reason: '발화와 새 문맥 확인', speech: '설명을 듣고, 최신 상황에 맞춰 제안을 다시 검토한다.' };
    const events = $(root, '[data-initiative-events]'); events.replaceChildren(...data.events.map(value => { const el = document.createElement('div'); el.textContent = value; return el; }));
    text(root, '[data-initiative-gate]', data.gate); text(root, '[data-initiative-reason]', data.reason); text(root, '[data-initiative-speech]', data.speech);
  }
  function renderChoices() { renderContext(); renderObservation(); renderDecision(); renderInitiative(); }

  function init() {
    if (ready) return; ready = true;
    $$ (document, '[data-scene]').forEach(scene);
    new Sequence('flow', [
      { nodes:['human','live'], edge:'voice', route:'플레이어 ↔ GPT-Live', message:'“문을 통과할 때까지\n파란 발판을 밟고 있어.”\n\n오디오 → WebRTC 미디어 트랙', caption:'① 사람은 말로 요청하고 GPT-Live는 음성 대화를 이어간다.' },
      { nodes:['live','coord'], edge:'request', route:'GPT-Live → 조정기', message:'전사 조각 + 위임 메타데이터\n\nsession.input_transcript.delta\nsession.delegation.created\n\n앱이 지시 문맥을 구성', caption:'② 조정기가 전사·현재 목표를 연결한다. 위임 이벤트에는 지시문이 없다.' },
      { nodes:['engine','coord'], edge:'state', route:'언리얼 → 조정기', message:'{\n  "revision": 42,\n  "known": ["파랑", "노랑"],\n  "actions": [\n    "hold_blue", "hold_yellow"\n  ]\n}', caption:'③ AI가 관찰한 객체와 행동 후보를 게임 JSON으로 받는다.' },
      { nodes:['coord','fast'], edge:'fast', route:'조정기 ↔ 빠른 판단', message:'입력: 지시 + 상태 + 후보\n\n{\n  "action_id": "hold_blue"\n}', caption:'④ 빠른 모델이 현재 실행할 행동 하나를 제안한다.' },
      { nodes:['coord','slow'], edge:'slow', route:'필요한 경우 조정기 ↔ 계획', message:'새 목표 · 막힘 · 규칙 발견\n\n출력: 순서 + 조건 + 질문\n\n기존 유효한 행동은 계속', caption:'⑤ 복잡한 문제는 별도로 계획한다. 모든 행동에서 기다리지 않는다.' },
      { nodes:['coord','engine'], edge:'execute', route:'조정기 → 언리얼 실행기', message:'{\n  "operation_id": "op_17",\n  "task_epoch": 7,\n  "action_id": "hold_blue"\n}\n\n버전·대상·전제조건 확인', caption:'⑥ 검증된 명령을 실행기로 보내 이동과 발판 유지를 시작한다.' },
      { nodes:['engine','coord'], edge:'state', route:'언리얼 → 조정기', message:'{\n  "operation_id": "op_17",\n  "state": "Holding",\n  "plate_contact": true\n}', caption:'⑦ 실제 접촉 결과를 받는다. 접수와 성공, 유지 상태를 구분한다.' },
      { nodes:['coord','live','human'], edge:'return', route:'조정기 → GPT-Live → 사람', message:'session.commentary.append\n\n“발판을 밟고 있어.\n 지나가면 알려줘.”\n\n확인된 결과를 음성으로', caption:'⑧ 게임에서 확인된 결과가 다시 대화로 돌아온다.' }
    ], (root, frame) => {
      $$(root, '[data-node]').forEach(el => el.classList.toggle('active', frame.nodes.includes(el.dataset.node)));
      $$(root, '[data-edge]').forEach(el => el.classList.toggle('active', frame.edge === el.dataset.edge));
      text(root, '[data-message-route]', frame.route); text(root, '[data-message]', frame.message);
    });

    new Sequence('connect', [
      { label:'브라우저 · 사용자가 연결 버튼 클릭', code:'const mic = await\n  navigator.mediaDevices\n    .getUserMedia({ audio: true });\n\npeer.addTrack(\n  mic.getAudioTracks()[0], mic\n);', caption:'① 마이크 오디오 트랙이 실제 음성 입력 통로다.' },
      { label:'브라우저 · 연결 협상', code:'const events =\n  peer.createDataChannel(\n    "oai-events"\n  );\n\nconst offer = await\n  peer.createOffer();', caption:'② 이벤트 채널을 먼저 만들고 SDP offer를 서버로 보낸다.' },
      { label:'서버 · POST /v1/live/sessions', code:'{\n  session: {\n    model: "gpt-live-1",\n    delegation: {type: "client"}\n  },\n  transport: {\n    type: "webrtc", sdp: offer.sdp\n  }\n}', caption:'③ 서버가 프로젝트 API 키로 세션을 생성한다. 게임 연구는 client 위임을 사용한다.' },
      { label:'브라우저 · 반환값과 시작 확인', code:'result.session.id\nresult.transport.sdp\n\npeer.setRemoteDescription({\n  type: "answer",\n  sdp: result.transport.sdp\n});\n\n// session.started 수신', caption:'④ SDP answer를 적용한다. 오디오는 미디어 트랙, 전사는 이벤트로 받는다.' },
      { label:'서버 · 기존 세션에 붙는 제어 연결', code:'wss://api.openai.com/v1/live/\nsessions/{session_id}/attach\n\n수신: 전사 · 위임 · 상태\n송신: 문맥 · 결과 · 제어\n\n기본 음성은 WebRTC로 유지', caption:'⑤ 같은 세션의 sideband에서 앱이 대화 문맥과 게임 결과를 관리한다.' }
    ], (root, frame, index) => {
      $$(root, '[data-connect-steps] li').forEach((el, i) => { el.classList.toggle('active', i === index); el.classList.toggle('done', i < index); });
      text(root, '[data-connect-label]', frame.label); text(root, '[data-connect-code]', frame.code);
    });

    new Sequence('execute', [
      { x:1, state:'Accepted', label:'조정기 → 실행기', output:'{\n  "operation_id": "op_17",\n  "action_id": "hold_blue",\n  "task_epoch": 7\n}', speech:'행동 접수 · 아직 발판에 도착하지 않음', caption:'① 현재 작업·대상·실행 조건을 확인한 뒤 접수한다.' },
      { x:2, state:'Moving', label:'실행기 · 경로 따라 이동', output:'{\n  "operation_id": "op_17",\n  "state": "Moving",\n  "agent_cell": [2, 2, 0]\n}', speech:'엔진이 이동을 계속 수행', caption:'② 이동 프레임마다 LLM을 호출하지 않는다.' },
      { x:3, state:'Moving', label:'실행기 · 이동 지속', output:'{\n  "operation_id": "op_17",\n  "state": "Moving",\n  "agent_cell": [3, 2, 0]\n}', speech:'장애물이 생기면 실패·재계획으로 연결', caption:'③ 이동 중에도 플레이어 음성이나 새 계획을 받을 수 있다.' },
      { x:4, state:'Holding', label:'엔진 → 조정기 · 실제 접촉 확인', output:'{\n  "operation_id": "op_17",\n  "state": "Holding",\n  "plate_contact": true,\n  "task_complete": false\n}', speech:'발판 접촉 → 문 열림 → 유지', caption:'④ 발판을 밟은 상태를 유지한다. 전체 작업 완료와는 다르다.' },
      { x:4, state:'Holding', label:'조정기 → GPT-Live · 결과 회신', output:'session.commentary.append\n\ncontent: "파란 발판 접촉 확인.\n플레이어 통과 확인을 기다린다."\n\ndelegation_id: 받은 위임 ID', speech:'“밟고 있어. 지나가면 알려줘.”', caption:'⑤ 실제 상태를 음성으로 알린다. 통과를 못 보면 플레이어 확인을 기다린다.' }
    ], (root, frame) => {
      const map = $(root, '[data-scene]'); $(map, '.npc').style.setProperty('--x', frame.x);
      $(map, '.door').classList.toggle('open', frame.state === 'Holding');
      $$(root, '[data-status]').forEach(el => el.classList.toggle('active', el.dataset.status === frame.state));
      text(root, '[data-execution-label]', frame.label); text(root, '[data-execution-output]', frame.output); text(root, '[data-execution-speech]', frame.speech);
    });

    new Sequence('plan', [
      { condition:'AI의 발판 유지 작업이 먼저 성립해야 함', caption:'① 복잡한 계획을 세워도 현재 필요한 발판 유지는 계속한다.' },
      { condition:'레버의 실제 기능은 사람의 관찰로 확인', caption:'② 모르는 장치의 효과를 모델이 임의로 확정하지 않는다.' },
      { condition:'문 고정이 가능하고 조작 결과가 확인되면 진행', caption:'③ 사람의 행동은 요청하고 실제 결과를 기다린다.' },
      { condition:'문이 유지됨을 확인한 뒤 AI가 이동', caption:'④ 새 계획은 단계별 조건을 만족할 때 행동으로 바뀐다.' }
    ], (root, frame, index) => {
      $$(root, '[data-plan-step]').forEach((el, i) => { el.classList.toggle('active', i === index); el.classList.toggle('done', i < index); });
      text(root, '[data-plan-condition]', frame.condition);
    });

    const parallelFrames = Array.from({ length:13 }, (_, index) => ({ caption:index < 2 ? '현재 지시만으로 할 수 있는 유효한 행동이 있다고 가정한다.' : '계획이 준비되는 동안 실행기가 유효한 이동·유지를 계속할 수 있다.' }));
    new Sequence('parallel', parallelFrames, (root, _frame, index) => {
      const duration = choices.duration;
      const spans = { 'serial-plan':[0,duration], 'serial-fast':[duration,duration+2], 'serial-run':[duration+2,12], 'parallel-plan':[0,duration], 'parallel-fast':[0,2], 'parallel-run':[2,12] };
      $$(root, '[data-bar]').forEach(el => { const [from,to] = spans[el.dataset.bar]; el.style.left = `${from/12*100}%`; el.style.width = `${(to-from)/12*100}%`; el.classList.toggle('started', index >= from); });
      $(root, '[data-time-cursor]').style.left = `${15+index/12*85}%`;
      text(root, '[data-time-label]', index === 12 ? '' : `${index}단계`);
      text(root, '#duration-output', duration);
    }, 8);

    new Sequence('cancel', [
      { epoch:7, old:true, current:false, incoming:'작업 7 판단 요청', verdict:'응답 대기', action:'명령 없음', detail:'모델 판단이 아직 도착하지 않음', caption:'① 파란 발판 요청을 작업 7에 연결해 보낸다.' },
      { epoch:8, old:false, current:true, incoming:'작업 8 판단 요청', verdict:'목표 변경', action:'새 지시 대기', detail:'이전 요청이 늦게 와도 새 목표를 우선', caption:'② 사람이 지시를 바꾸면 현재 작업 버전이 8이 된다.' },
      { epoch:8, old:false, current:true, incoming:'늦은 응답: 작업 7\naction_id: hold_blue', verdict:'폐기 · 버전 불일치', rejected:true, action:'파랑 실행 안 함', detail:'7 ≠ 현재 작업 8', caption:'③ 이전 응답이 도착해도 언리얼로 보내지 않는다.' },
      { epoch:8, old:false, current:true, incoming:'현재 응답: 작업 8\naction_id: hold_yellow', verdict:'조건 확인 후 실행', action:'노란 발판 유지', detail:'현재 목표와 대상 조건을 모두 확인', caption:'④ 현재 작업의 응답만 검증해 실제 행동으로 연결한다.' }
    ], (root, frame) => {
      $(root, '[data-command="old"]').classList.toggle('active', frame.old); $(root, '[data-command="new"]').classList.toggle('active', frame.current);
      text(root, '[data-current-epoch]', frame.epoch); text(root, '[data-arriving-response]', frame.incoming); text(root, '[data-gate-verdict]', frame.verdict);
      $(root, '[data-gate-verdict]').classList.toggle('rejected', !!frame.rejected);
      text(root, '[data-cancel-action]', frame.action); text(root, '[data-cancel-detail]', frame.detail);
    }, 2);

    new Sequence('sync', [
      { clock:'준비', event:'아직 실행 시각을 예약하지 않음', ai:'AI 도착', human:'사람 이동 중', caption:'① AI가 스위치에 도착해도 바로 조작하지 않는다.' },
      { clock:'대기', event:'양측 준비 · 시작 확인', ai:'AI 준비 완료', human:'사람 준비 완료', caption:'② 플레이어의 준비를 확인한 뒤 공통 게임 시계에 실행을 예약한다.' },
      { clock:'3', event:'엔진 카운트다운', ai:'예약 실행 대기', human:'직접 입력 준비', caption:'③ 카운트다운은 엔진에서 표시한다. 모델 응답 속도와 분리한다.' },
      { clock:'2', event:'엔진 카운트다운', ai:'예약 실행 대기', human:'직접 입력 준비', caption:'④ 준비 조건이 깨지면 예약을 취소할 수 있어야 한다.' },
      { clock:'1', event:'엔진 카운트다운', ai:'예약 실행 대기', human:'직접 입력 준비', caption:'⑤ 정확한 조작 시각은 대화 생성의 박자에 맡기지 않는다.' },
      { clock:'실행', event:'각 입력 시각을 기록해 차이를 평가', ai:'엔진 예약 조작', human:'사람 입력 예시', pressed:true, caption:'⑥ AI 예약 실행과 사람의 실제 입력을 같은 게임 시계로 기록한다.' }
    ], (root, frame) => {
      text(root, '[data-countdown]', frame.clock); text(root, '[data-sync-event]', frame.event); text(root, '[data-sync-ai]', frame.ai); text(root, '[data-sync-human]', frame.human);
      $$(root, '[data-station]').forEach(el => el.classList.toggle('pressed', !!frame.pressed));
    });

    for (const [selector, field, key, render] of [ ['[data-context]','context','context',renderContext], ['[data-observation]','observation','observation',renderObservation], ['[data-request]','request','request',renderDecision], ['[data-initiative]','initiative','initiative',renderInitiative] ]) {
      $$(document, selector).forEach(button => button.addEventListener('click', () => { choices[key] = button.dataset[field]; render(); }));
    }
    const range = document.getElementById('plan-duration'); range.addEventListener('input', () => { choices.duration = Number(range.value); demos.get('parallel').set(demos.get('parallel').index); });
    renderChoices();
    window.coopAIDeck = { demos, choices, setStep: (name, index) => demos.get(name)?.set(index), snapshot: () => ({ choices: { ...choices }, frames: Object.fromEntries([...demos].map(([key, value]) => [key, value.index])), playing: [...demos].filter(([,value]) => value.timer !== null).map(([key]) => key), printing }) };
    if (document.documentElement.classList.contains('print-view')) preparePrint();
  }

  function preparePrint() {
    if (!ready) return;
    if (!savedPrintState) savedPrintState = { choices: { ...choices }, frames: Object.fromEntries([...demos].map(([key, value]) => [key, value.index])) };
    printing = true;
    demos.forEach(demo => { demo.pause(); demo.set(demo.printIndex); });
    choices.context = 'print'; choices.observation = 'known'; choices.request = 'clear'; choices.initiative = 'stuck'; renderChoices();
    const flow = demos.get('flow').root;
    $$(flow, '[data-node]').forEach(el => el.classList.add('active'));
    text(flow, '[data-message-route]', '음성 → 판단 → 행동 → 확인');
    text(flow, '[data-message]', '음성: WebRTC\n전사·위임: 이벤트\n게임 상태: JSON\n모델 응답: 행동·계획\n엔진 명령: 작업 ID + 행동\n실행 결과: 실제 상태\n음성 안내: 확인된 결과');
    const connect = demos.get('connect').root;
    text(connect, '[data-connect-label]', 'WebRTC 세션 + 서버 제어 연결');
    text(connect, '[data-connect-code]', 'POST /v1/live/sessions\n{ session: { model: "gpt-live-1",\n  delegation: {type: "client"} },\n  transport: {type: "webrtc", sdp} }\n\n반환: session.id / transport.sdp\n\nsideband: /live/sessions/\n{session_id}/attach\n\n음성: 미디어 트랙\n전사·문맥·제어: 이벤트');
    $$(connect, '[data-connect-steps] li').forEach(el => el.classList.add('done'));
    const plan = demos.get('plan').root; $$(plan, '[data-plan-step]').forEach(el => el.classList.add('done'));
  }
  window.addEventListener('deck:slidechange', ({detail}) => { demos.forEach(demo => { if (demo.root !== detail.slide) demo.pause(); }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) demos.forEach(demo => demo.pause()); });
  window.addEventListener('deck:prepareprint', preparePrint);
  window.addEventListener('afterprint', () => {
    if (!savedPrintState || window.ppt205Deck?.isPrint) return;
    printing = false; Object.assign(choices, savedPrintState.choices);
    document.getElementById('plan-duration').value = choices.duration;
    demos.forEach((demo, name) => demo.set(savedPrintState.frames[name]));
    renderChoices(); savedPrintState = null;
  });
  window.addEventListener('DOMContentLoaded', init);
})();
