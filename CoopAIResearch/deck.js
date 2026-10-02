(() => {
  'use strict';
  const proto = window.PPT205?.Deck.prototype;
  if (!proto) return;
  const originalGo = proto.go;
  // Keep the shared deck's keyboard, notes, hash, and PDF contract while showing
  // every chapter as a continuous document in this entry only.
  proto.go = function (index, options = {}) {
    originalGo.call(this, index, options);
    if (this.isPrint || document.documentElement.classList.contains('print-view')) return;
    this.slides.forEach(slide => {
      slide.setAttribute('aria-hidden', 'false');
      slide.inert = false;
    });
    if (!options.fromScroll) this.root.scrollTop = this.slides[this.current].offsetTop;
  };

  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = prefersReduced.matches;
  let printing = false;
  let savedPrint = null;
  let frame = 0;
  let previousTime = 0;
  let animations = [];
  let deck;
  const puzzleCaptions = [
    '① 요청: “내가 지나갈 때까지 발판을 밟고 있어 줘.”',
    '② 선택·이동: AI가 지시에 맞는 발판으로 이동합니다.',
    '③ 유지: 발판이 켜지고 문이 열립니다. 사람은 아직 통과 전입니다.',
    '④ 협동: AI가 발판을 계속 유지하는 동안 사람이 통과합니다.',
    '⑤ 완료 확인: 실제 사람 통과까지 확인해야 과제가 끝납니다.'
  ];
  const descriptions = {
    stale: [
      '① 공개된 최신 상태를 관측해 모델에 전달합니다.',
      '② 모델이 다음 행동을 고르는 동안 게임은 계속 진행됩니다.',
      '③ 경로가 막혔습니다. 이전 관측만으로 내린 선택은 오래된 판단입니다.',
      '④ 실행 전에 다시 검사합니다. 목표 관련 변화라면 재관측·재판단을 검토합니다.'
    ],
    flow: [
      '① 대화 AI가 만든 요청 후보를 사용자가 확정합니다.',
      '② 조정기가 확정 지시·최신 관측·관련 기억을 모읍니다.',
      '③ 행동 AI가 허용된 정보에서 다음 행동이나 확인 질문을 고릅니다.',
      '④ 코드가 응답과 현재 상태를 검사한 뒤 Unreal 실행기로 보냅니다.',
      '⑤ 실제 진행·완료·실패 결과를 조정기가 받아 다음 판단에 사용합니다.'
    ],
    lora: [
      '① 기반 모델의 가중치는 학습 중 고정합니다.',
      '② 검토된 지시·관측·정답 사례로 작은 변경분을 학습합니다.',
      '③ 바뀌는 것은 어댑터입니다. 기반 모델 전체를 다시 학습하지 않습니다.',
      '④ 기반 모델과 학습한 변경분을 같은 행동 AI 자리에 적용합니다.'
    ],
    matrix: [
      'A ↔ B: 학습 전 모델에서 재판단 방식의 효과를 비교합니다.',
      'C ↔ D: LoRA 적용 뒤에도 재판단 방식의 효과가 있는지 봅니다.',
      'A ↔ C: 고정 주기 조건에서 파인튜닝의 효과를 비교합니다.',
      'B ↔ D: 상황 기반 조건에서 파인튜닝의 효과를 비교합니다.'
    ]
  };
  const samples = [
    ['“내가 지나갈 때까지 발판을 밟아 줘.”', 'AI용 발판 A가 관측됨. 사람이 아직 통과하지 않음.', '발판 유지', '이동 후 멈추는 것만으로는 지시를 충족하지 못합니다.', '① 행동의 지속 조건을 구분하는 사례'],
    ['“저 발판으로 가 줘.”', '발판 A와 B가 모두 보임. 어느 쪽인지 가리키는 정보는 없음.', '대상 확인 질문', '공개된 정보로 하나를 정할 수 없으므로 어느 발판인지 묻습니다.', '② 추측 대신 필요한 정보를 묻는 사례'],
    ['“내가 문을 열면 안으로 들어가 줘.”', '문은 닫혀 있음. 사람이 먼저 해야 할 동작은 아직 끝나지 않음.', '조건이 충족될 때까지 대기', '사람의 선행 동작을 기다리고 문이 열렸는지 다시 확인해야 합니다.', '③ 사람과의 행동 순서를 지키는 사례']
  ];
  const put = (el, selector, text) => {
    const target = el.querySelector(selector);
    if (target) target.textContent = text;
  };
  function render(anim, phase) {
    const el = anim.el;
    anim.phase = phase;
    el.dataset.phase = String(phase);
    if (anim.kind === 'hero' || anim.kind === 'puzzle') {
      put(el, '[data-caption]', puzzleCaptions[phase]);
      put(el, '[data-plate-state]', phase >= 2 ? '유지 중' : '비활성');
      put(el, '[data-door-state]', phase >= 2 ? '열림' : '닫힘');
      put(el, '[data-task-state]', phase === 4 ? '완료 확인' : '진행 중');
    } else if (anim.kind === 'stale') {
      put(el, '[data-caption]', descriptions.stale[phase]);
      put(el, '[data-stale-state]', phase >= 2 ? '길이 막혔음' : '길이 열려 있음');
    } else if (anim.kind === 'flow') {
      put(el, '[data-caption]', descriptions.flow[phase]);
      el.querySelectorAll('[data-flow]').forEach(node => node.classList.toggle('is-lit', Number(node.dataset.flow) === (phase === 4 ? 1 : phase)));
    } else if (anim.kind === 'schedule') {
      el.querySelectorAll('[data-ticks]').forEach(line => {
        [...line.children].forEach((tick, index) => {
          tick.classList.toggle('is-current', phase === index);
          tick.classList.toggle('is-future', phase < index);
        });
      });
      put(el, '[data-caption]', phase < 4
        ? '안정 구간: 현재 행동을 이어 가며 중요한 변화가 있는지 관측합니다.'
        : phase < 9
          ? '경로 차단: 목표에 필요한 조건이 바뀌어 재판단을 검토합니다.'
          : '지시 변경: 사용자가 확정한 새 목표에 맞춰 다시 판단합니다.');
    } else if (anim.kind === 'lora') {
      put(el, '[data-caption]', descriptions.lora[phase]);
      el.querySelectorAll('.adapter-grid i').forEach((cell, index) => cell.classList.toggle('is-updated', phase > 0 && index < phase * 4));
    } else if (anim.kind === 'sample') {
      const [request, observation, action, reason, caption] = samples[phase];
      put(el, '[data-sample-request]', request);
      put(el, '[data-sample-observation]', observation);
      put(el, '[data-sample-action]', action);
      put(el, '[data-sample-reason]', reason);
      put(el, '[data-caption]', caption);
    } else if (anim.kind === 'matrix') {
      const pair = [['A', 'B'], ['C', 'D'], ['A', 'C'], ['B', 'D']][phase];
      el.querySelectorAll('[data-cell]').forEach(cell => cell.classList.toggle('is-lit', pair.includes(cell.dataset.cell)));
      put(el, '[data-caption]', descriptions.matrix[phase]);
    }
  }
  function currentAnimations() {
    return animations.filter(anim => anim.el.closest('.slide') === deck?.slides[deck.current]);
  }
  function canPlay() { return !paused && !printing && !document.hidden && !deck?.isPrint; }
  function cancel() { cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
  function tick(time) {
    frame = 0;
    if (!canPlay()) return;
    const dt = previousTime ? Math.min(time - previousTime, 100) : 0;
    previousTime = time;
    const active = currentAnimations();
    active.forEach(anim => {
      anim.elapsed = (anim.elapsed + dt) % (anim.step * anim.count);
      const phase = Math.floor(anim.elapsed / anim.step);
      if (phase !== anim.phase) render(anim, phase);
      const bar = anim.el.querySelector('.animation-track > i');
      if (bar) bar.style.width = `${anim.elapsed / (anim.step * anim.count) * 100}%`;
    });
    if (active.length) frame = requestAnimationFrame(tick);
    else previousTime = 0;
  }
  function play() { if (canPlay() && !frame && currentAnimations().length) frame = requestAnimationFrame(tick); }
  function updatePause() {
    document.body.classList.toggle('motion-paused', paused || printing);
    const button = document.getElementById('motion-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(paused));
      button.textContent = paused ? '▶ 애니메이션 재생' : 'Ⅱ 애니메이션 일시정지';
    }
    if (paused || printing) cancel(); else play();
  }
  function syncNav(index) {
    document.querySelectorAll('[data-chapter]').forEach(link => {
      if (Number(link.dataset.chapter) === index) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
  function printState() {
    if (!animations.length) return;
    if (!savedPrint) savedPrint = animations.map(anim => ({ elapsed: anim.elapsed, phase: anim.phase }));
    printing = true;
    cancel();
    document.body.classList.add('motion-paused');
    animations.forEach(anim => {
      const states = { hero: 4, puzzle: 4, stale: 3, flow: 4, schedule: 11, lora: 3, sample: 0, matrix: 0 };
      render(anim, states[anim.kind]);
      if (anim.kind === 'flow') anim.el.querySelectorAll('[data-flow]').forEach(node => node.classList.add('is-lit'));
      if (anim.kind === 'matrix') {
        anim.el.querySelectorAll('[data-cell]').forEach(node => node.classList.add('is-lit'));
        put(anim.el, '[data-caption]', 'A–B·C–D는 호출 방식, A–C·B–D는 학습 효과를 비교합니다.');
      }
      if (anim.kind === 'schedule') put(anim.el, '[data-caption]', '같은 변화에서 호출 시점만 다르게 정하는 설명용 시간선입니다.');
    });
  }
  window.addEventListener('deck:prepareprint', printState);
  window.addEventListener('afterprint', () => {
    if (deck?.isPrint) return;
    printing = false;
    if (savedPrint) {
      animations.forEach((anim, index) => {
        anim.elapsed = savedPrint[index].elapsed;
        render(anim, savedPrint[index].phase);
      });
      savedPrint = null;
    }
    updatePause();
  });
  window.addEventListener('deck:slidechange', event => {
    syncNav(event.detail.index);
    cancel();
    play();
  });
  window.addEventListener('DOMContentLoaded', () => {
    deck = window.ppt205Deck;
    document.querySelectorAll('[data-ticks]').forEach(line => {
      const calls = line.dataset.ticks === 'periodic' ? [0, 3, 6, 9] : [0, 4, 9];
      for (let index = 0; index < 12; index++) {
        const tick = document.createElement('span');
        tick.className = `tick${calls.includes(index) ? ' is-call' : ''}${[4, 9].includes(index) ? ' is-event' : ''}`;
        tick.setAttribute('aria-hidden', 'true');
        line.append(tick);
      }
      line.setAttribute('aria-label', line.dataset.ticks === 'periodic' ? '고정된 간격으로 호출하는 설명용 모형' : '초기 지시와 중요한 상태 변화 때 호출하는 설명용 모형');
    });
    animations = [...document.querySelectorAll('[data-anim]')].map(el => {
      const kind = el.dataset.anim;
      const spec = {
        hero: [5, 3000], puzzle: [5, 3200], stale: [4, 3400],
        flow: [5, 3400], schedule: [12, 1100], lora: [4, 3600],
        sample: [3, 7000], matrix: [4, 4800]
      }[kind];
      const anim = { el, kind, count: spec[0], step: spec[1], phase: 0, elapsed: 0 };
      render(anim, 0);
      return anim;
    });
    if (prefersReduced.matches && !deck?.isPrint) {
      animations.forEach(anim => {
        const phase = ['hero', 'puzzle'].includes(anim.kind) ? 2 : 0;
        anim.elapsed = phase * anim.step;
        render(anim, phase);
      });
    }
    if (deck?.isPrint || document.documentElement.classList.contains('print-view')) printState();
    updatePause();
    syncNav(deck.current);
    document.getElementById('motion-toggle').addEventListener('click', () => { paused = !paused; updatePause(); });
    const menu = document.getElementById('menu-toggle');
    function closeNav() {
      document.body.classList.remove('nav-open');
      menu.setAttribute('aria-expanded', 'false');
    }
    menu.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      menu.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('[data-chapter]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      deck.go(Number(link.dataset.chapter));
      closeNav();
    }));
    deck.root.addEventListener('click', closeNav);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeNav(); });
    let scrollFrame = 0;
    deck.root.addEventListener('scroll', () => {
      if (printing || deck.isPrint || scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        if (printing || deck.isPrint) return;
        const top = deck.root.scrollTop + Math.min(180, deck.root.clientHeight * .2);
        let next = 0;
        deck.slides.forEach((slide, index) => { if (slide.offsetTop <= top) next = index; });
        if (next !== deck.current) deck.go(next, { fromScroll: true });
      });
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); else play(); });
    prefersReduced.addEventListener('change', event => {
      if (event.matches) { paused = true; updatePause(); }
    });
    window.researchPage = Object.freeze({
      get paused() { return paused; },
      get printing() { return printing; },
      get states() { return animations.map(({ kind, phase, elapsed }) => ({ kind, phase, elapsed })); }
    });
  });
})();
