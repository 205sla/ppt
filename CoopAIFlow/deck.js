(() => {
  'use strict';
  const frames = [
    { title:'대화 AI와 행동 AI, 두 역할로 연결한다', route:'한 화면에서 보는 동작 과정', description:'조정기와 언리얼은 일반 코드입니다. 재생하면 두 AI와 엔진 사이의 정보가 이동합니다.', label:'예시 데이터', packet:'음성 요청 + 관찰 가능한 게임 상태\n가능한 행동 선택 + 엔진 실행\n실제 결과 확인 + 음성 안내', nodes:[], edges:[], x:1, state:'Idle' },
    { title:'플레이어가 말로 요청한다', route:'플레이어 → 대화 AI (GPT-Live)', description:'마이크 음성이 WebRTC 미디어 트랙으로 전달됩니다.', label:'실제 음성 입력 통로', packet:'마이크 오디오 → WebRTC 미디어 트랙\n“문을 통과할 때까지 파란 발판을 밟고 있어.”', nodes:['human','live'], edges:['voice-in'], x:1, state:'Idle' },
    { title:'조정기가 지시 문맥을 구성한다', route:'대화 AI → 조정 코드', description:'전사와 위임 ID를 현재 작업에 연결하고, 수정·대상·의도를 확인합니다.', label:'이벤트에서 얻은 정보 · 축약 예시', packet:'전사: “파란 발판을 밟고 있어.”\n위임: { id: "item_demo", target: "client" }\n// 위임 이벤트 자체에는 지시문이 없음', nodes:['live','coordinator'], edges:['request'], x:1, state:'Idle' },
    { title:'게임이 관찰 정보와 행동 후보를 보낸다', route:'언리얼 → 조정기', description:'AI에게 보이는 정보와 지금 가능한 행동을 JSON으로 전달합니다.', label:'게임 상태 JSON · 예시', packet:'{ "agent_cell": [1,2,0],\n  "known_objects": ["plate_blue","plate_yellow","door"],\n  "available_actions": ["hold_blue","hold_yellow","ask_player"] }', nodes:['engine','coordinator'], edges:['state'], x:1, state:'Idle' },
    { title:'행동 AI가 다음 행동 하나를 고른다', route:'조정 코드 ↔ 행동 AI 하나', description:'같은 행동 AI가 선택·계획·재판단을 맡습니다. 지금은 파란 발판 유지를 선택합니다.', label:'행동 판단의 출력 · 예시', packet:'{ "kind": "action",\n  "action_id": "hold_blue" }\n// 아직 게임 속 AI는 움직이지 않음', nodes:['coordinator','action'], edges:['decision'], x:1, state:'Selected' },
    { title:'현재 조건을 검증한 뒤 명령을 접수한다', route:'조정기 → 언리얼 실행기', description:'작업 버전과 대상, 실행 조건을 확인합니다. Accepted는 접수 상태입니다.', label:'검증된 게임 명령 · 예시', packet:'{ "operation_id": "op_17", "task_epoch": 7,\n  "action_id": "hold_blue" }\n실행 상태: Accepted', nodes:['coordinator','engine'], edges:['action'], x:1, state:'Accepted' },
    { title:'엔진이 경로를 따라 이동을 시작한다', route:'언리얼 실행기 · Moving', description:'한 번 받은 행동으로 이동을 이어갑니다. 매 프레임마다 모델을 호출하지 않습니다.', label:'엔진의 진행 상태 · 예시', packet:'{ "operation_id": "op_17",\n  "state": "Moving", "agent_cell": [2,2,0] }', nodes:['engine'], edges:[], x:2, state:'Moving' },
    { title:'대화를 이어가면서 이동을 계속한다', route:'실행 코드가 이동 · 대화 AI는 소통', description:'이동 중에도 음성을 받을 수 있습니다. 새 정보가 생기면 같은 행동 AI에 재판단을 요청합니다.', label:'같은 행동의 목표 위치 · 예시', packet:'{ "operation_id": "op_17", "state": "Moving",\n  "target_cell": [4,2,0], "contact_confirmed": false }', nodes:['engine'], edges:[], x:4, state:'Moving' },
    { title:'실제로 발판을 밟으면 문이 열린다', route:'언리얼 → 조정기 · 실제 접촉 확인', description:'Holding은 발판을 밟고 유지하는 상태입니다. 플레이어의 통과 확인을 기다립니다.', label:'실행 결과 JSON · 예시', packet:'{ "operation_id": "op_17", "state": "Holding",\n  "plate_contact": true, "task_complete": false }', nodes:['engine','coordinator'], edges:['state'], x:4, state:'Holding' },
    { title:'확인된 결과를 음성으로 알려준다', route:'조정 코드 → 대화 AI → 플레이어', description:'실제 접촉 결과를 대화에 반영합니다. AI는 발판 유지를 계속합니다.', label:'결과 회신 · item_demo는 받은 위임 ID의 예시', packet:'{ "type": "session.commentary.append",\n  "delegation_id": "item_demo",\n  "content": "파란 발판 접촉 확인. 통과 확인을 기다린다." }', nodes:['coordinator','live','human'], edges:['reply','voice-out'], x:4, state:'Holding' }
  ];
  let step = 0, reconsider = false, timer = null, printing = false, saved = null, ready = false;
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const setText = (selector, value) => { $(selector).textContent = value; };
  function render() {
    const frame = frames[step];
    const reconsidering = reconsider && step >= 6;
    const holding = frame.state === 'Holding';
    const activeNodes = new Set(frame.nodes);
    const activeEdges = new Set(frame.edges);
    if (reconsidering) { activeNodes.add('action'); activeNodes.add('coordinator'); activeEdges.add('decision'); }
    all('[data-node]').forEach(node => node.classList.toggle('active', activeNodes.has(node.dataset.node)));
    all('[data-edge]').forEach(edge => edge.classList.toggle('active', activeEdges.has(edge.dataset.edge)));
    $('.overview').dataset.playing = String(timer !== null);
    $('.overview').dataset.step = String(step);
    setText('[data-step-title]', frame.title);
    setText('[data-route]', frame.route);
    setText('[data-description]', reconsidering && step === 6 ? '이동은 엔진이 계속하고, 추가 목표인 역할 교대는 같은 행동 AI 한 개가 다시 판단합니다.' : reconsidering && step === 7 ? '행동 AI의 다음 판단을 기다려도 유효한 이동은 계속합니다. 대화 AI와도 소통할 수 있습니다.' : frame.description);
    setText('[data-packet-label]', frame.label);
    setText('[data-packet]', frame.packet);
    setText('[data-human-detail]', step === 1 ? '음성으로 요청' : step === 9 ? '결과를 듣기' : '말로 요청');
    setText('[data-live-detail]', step === 1 ? '마이크 음성 수신' : step === 2 ? '전사·위임 전달' : step === 9 ? '결과를 음성으로' : '듣기와 말하기');
    setText('[data-coordinator-detail]', step === 2 ? '지시 문맥 확인' : step === 3 ? '관찰 정보와 연결' : step === 5 ? '버전·실행 조건 검증' : step >= 8 ? '접촉 확인 · 유지 중' : '지시와 상태를 연결');
    setText('[data-action-detail]', reconsidering ? '같은 AI로 역할 교대 재판단 중' : step >= 4 ? 'hold_blue 선택 · 계획도 같은 AI' : '선택 · 계획 · 재판단');
    $('[data-npc]').style.left = `${frame.x * 10 + 5}%`;
    $('[data-blue-plate]').classList.toggle('selected', step >= 4 && !holding);
    $('[data-blue-plate]').classList.toggle('pressed', holding);
    $('[data-door]').classList.toggle('open', holding);
    $('[data-map]').classList.toggle('moving', frame.state === 'Moving');
    $('[data-map]').setAttribute('aria-label', holding ? 'AI가 파란 발판을 밟아 문이 열렸고 플레이어 통과를 기다린다' : `AI 위치 [${frame.x},2,0], 문은 닫혀 있고 발판 접촉은 없다`);
    setText('[data-door-label]', holding ? '열린 문' : '닫힌 문');
    setText('[data-state]', frame.state === 'Idle' ? '명령 대기' : frame.state === 'Selected' ? '행동 제안' : frame.state);
    setText('[data-contact]', holding ? '실제 접촉: 확인' : '실제 접촉: 없음');
    all('[data-status]').forEach(status => status.classList.toggle('active', status.dataset.status === frame.state));
    setText('[data-speech]', step === 9 ? '“밟고 있어. 지나가면 알려줘.”' : holding ? '발판 유지 중 · 통과 확인 전에는 작업 미완료' : frame.state === 'Moving' ? '엔진이 이동을 수행 중 · 문은 아직 닫혀 있음' : frame.state === 'Accepted' ? '명령 접수 · 아직 발판에 도착하지 않음' : 'AI의 위치와 문 상태를 함께 확인한다.');
    $('[data-speech]').classList.toggle('spoken', step === 9);
    setText('[data-step-count]', `${step + 1} / ${frames.length}`);
    $('[data-play]').setAttribute('aria-pressed', String(timer !== null));
    setText('[data-play]', timer !== null ? '일시정지' : step === frames.length - 1 ? '다시 재생' : '재생');
    $('[data-previous]').disabled = step === 0;
    $('[data-next]').disabled = step === frames.length - 1;
    all('[data-go-step]').forEach(button => {
      const position = Number(button.dataset.goStep);
      if (position === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      button.classList.toggle('done', position < step);
    });
  }
  function pause() { if (timer !== null) clearTimeout(timer); timer = null; if (ready) render(); }
  function setStep(value) { pause(); step = Math.max(0, Math.min(frames.length - 1, value)); render(); }
  function schedule() {
    timer = setTimeout(() => {
      timer = null;
      if (printing || document.hidden) { render(); return; }
      step = Math.min(frames.length - 1, step + 1);
      if (step < frames.length - 1) schedule();
      render();
    }, 2100);
  }
  function play() {
    if (printing) return;
    if (timer !== null) { pause(); return; }
    if (step === frames.length - 1) step = 0;
    if (step === 0) step = 1;
    schedule(); render();
  }
  function preparePrint() {
    if (!ready) return;
    if (!saved) saved = { step, reconsider };
    pause(); printing = true; step = 8; reconsider = false; render();
    all('[data-node]').forEach(node => node.classList.add('active'));
    all('[data-edge]').forEach(edge => edge.classList.add('active'));
    setText('[data-route]', '전체 흐름 · 발판 접촉 시점');
    setText('[data-step-title]', '음성 지시를 실제 게임 행동으로 연결');
    setText('[data-description]', '행동 AI의 결정을 코드가 검증하고 엔진이 실행합니다. 대화 AI는 확인된 결과를 음성으로 알립니다.');
    setText('[data-packet-label]', '한 번의 요청이 연결되는 과정');
    setText('[data-packet]', '대화 AI: 음성 소통 + 확인된 결과 안내\n행동 AI: 선택 · 계획 · 재판단 (LLM 한 개)\n일반 코드: 정보 연결 · 검증 · 이동과 장치 실행\n실행 결과: Accepted → Moving → Holding');
    setText('[data-action-detail]', '선택 · 계획 · 재판단을 같은 AI가 담당');
    setText('[data-speech]', '접촉 확인 후 음성 안내 · “밟고 있어.”');
  }
  function init() {
    ready = true;
    frames.forEach((frame, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.goStep = String(index);
      button.title = `${index + 1}. ${frame.title}`; button.setAttribute('aria-label', button.title);
      button.addEventListener('click', () => setStep(index)); $('[data-step-dots]').append(button);
    });
    $('[data-play]').addEventListener('click', play);
    $('[data-previous]').addEventListener('click', () => setStep(step - 1));
    $('[data-next]').addEventListener('click', () => setStep(step + 1));
    $('[data-reset]').addEventListener('click', () => setStep(0));
    $('[data-reconsider]').addEventListener('change', event => { reconsider = event.target.checked; render(); });
    document.addEventListener('keydown', event => {
      if (printing || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,button,a,[contenteditable=true]')) return;
      if (['ArrowRight','PageDown','ArrowLeft','PageUp','Home','End',' '].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === ' ') play();
        else if (event.key === 'Home') setStep(0);
        else if (event.key === 'End') setStep(frames.length - 1);
        else setStep(step + (['ArrowRight','PageDown'].includes(event.key) ? 1 : -1));
      }
    }, true);
    render();
    window.coopAIFlow = {
      frames: frames.length, setStep,
      setReconsider(value) { reconsider = !!value; $('[data-reconsider]').checked = reconsider; render(); },
      snapshot() { return { step, reconsider, playing:timer !== null, printing, state:frames[step].state, cell:frames[step].x, contact:frames[step].state === 'Holding' }; }
    };
    if (document.documentElement.classList.contains('print-view')) preparePrint();
  }
  window.addEventListener('DOMContentLoaded', init);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('deck:slidechange', ({detail}) => { if (ready && !detail.slide?.classList.contains('overview')) pause(); });
  window.addEventListener('deck:prepareprint', preparePrint);
  window.addEventListener('afterprint', () => {
    if (!saved || window.ppt205Deck?.isPrint) return;
    printing = false; step = saved.step; reconsider = saved.reconsider; saved = null;
    $('[data-reconsider]').checked = reconsider; render();
  });
})();
