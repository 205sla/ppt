(() => {
  'use strict';
  const LIMITS = { name: 24, reason: 90, comment: 220, project: 60 };
  const base = window.COMMENT_AWARDS_CONTENT;
  const STORAGE_KEY = `ppt205.comment-awards.content.${base.revision || 'draft-v1'}`;
  const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const text = (value, limit) => typeof value === 'string' ? Array.from(value.trim()).slice(0, limit).join('') : '';
  const normalize = (value) => ({
    schemaVersion: 1, title: base.title,
    eventLabel: text(value?.eventLabel, 40) || base.eventLabel,
    winners: Array.from({ length: 3 }, (_, i) => Object.fromEntries(Object.entries(LIMITS).map(([field, limit]) => [field, text(value?.winners?.[i]?.[field], limit)]))),
    timings: {
      opening: 6, introduction: 8, suspense: 6,
      reveal: number(value?.timings?.reveal, base.timings.reveal, 6, 40),
      evidence: number(value?.timings?.evidence, base.timings.evidence, 8, 60)
    },
    sound: typeof value?.sound === 'boolean' ? value.sound : base.sound
  });
  let content = normalize(base);
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved?.schemaVersion === 1 && Array.isArray(saved.winners)) content = normalize(saved); } catch { /* file: 환경에서 저장이 제한되면 기본 내용을 사용한다. */ }

  class CeremonyAudio {
    constructor() { this.context = null; this.master = null; this.analyser = null; this.nodes = new Set(); this.muted = !content.sound; this.cueCount = 0; }
    async unlock() {
      try {
        if (!this.context) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return false;
          this.context = new Audio();
          this.master = this.context.createGain();
          this.master.gain.value = this.muted ? 0 : .23;
          this.analyser = this.context.createAnalyser();
          this.analyser.fftSize = 256;
          this.master.connect(this.analyser);
          this.analyser.connect(this.context.destination);
        }
        await this.context.resume();
        return this.context.state === 'running';
      } catch { return false; }
    }
    setMuted(muted) { this.muted = muted; if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .23, this.context.currentTime, .025); }
    tone(frequency, start, duration, volume = .25, type = 'sine', endFrequency = frequency) {
      if (!this.context || this.muted || this.context.state !== 'running') return;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const at = this.context.currentTime + start;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + .014);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(gain); gain.connect(this.master);
      this.nodes.add(oscillator);
      oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + duration + .02);
    }
    cue(kind) {
      if (!this.context || this.muted || this.context.state !== 'running') return;
      this.cueCount += 1;
      if (kind === 'count') {
        this.tone(150, 0, .28, .5, 'sine', 45);
        this.tone(720, 0, .11, .09);
      } else if (kind === 'suspense') {
        this.tone(110, 0, 1.4, .16);
        this.tone(164.81, .1, 1.3, .09);
      } else if (kind === 'reveal' || kind === 'finale') {
        [261.63, 329.63, 392, 523.25].forEach((note, i) => this.tone(note, i * .13, 1.65, .19, 'triangle'));
        this.tone(130.81, 0, 1.8, .24);
        if (kind === 'finale') [392, 523.25, 659.25, 783.99].forEach((note, i) => this.tone(note, 1.05 + i * .13, 1.5, .15, 'triangle'));
      } else if (kind === 'opening') {
        [196, 261.63, 392].forEach((note, i) => this.tone(note, i * .3, 1.4, .1));
      }
    }
    stop() { this.nodes.forEach((node) => { try { node.stop(); } catch { /* ended */ } }); }
    level() { if (!this.analyser) return 0; const data = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length); }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const deck = window.ppt205Deck;
    if (!deck) return;
    const audio = new CeremonyAudio();
    const body = document.body;
    const dialog = document.querySelector('.content-editor');
    const form = document.querySelector('#content-form');
    const status = document.querySelector('[data-playback-status]');
    const toggleButton = document.querySelector('[data-awards-toggle]');
    const soundButton = document.querySelector('[data-awards-sound]');
    const progress = document.querySelector('[data-awards-progress]');
    const state = { running: false, ready: deck.current === 0, ended: false, elapsed: 0, lastTime: 0, raf: null, cues: new Set(), print: deck.isPrint };
    let controlTimer;
    const duration = (slide) => (content.timings[slide.dataset.kind] || 0) * 1000;
    const totalDuration = () => deck.slides.reduce((total, slide) => total + duration(slide), 0);
    const elapsedTotal = () => deck.slides.slice(0, deck.current).reduce((total, slide) => total + duration(slide), 0) + state.elapsed;
    const readableTime = (seconds) => `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;

    function fit(element, maxFont, minFont, maxHeight) {
      if (!element || !element.offsetParent) return;
      const width = deck.root.clientWidth;
      let size = maxFont;
      element.style.fontSize = `${size}cqw`;
      while (size > minFont && (element.scrollHeight > maxHeight || element.scrollWidth > width * .86)) {
        size = Math.max(minFont, size - .1);
        element.style.fontSize = `${size.toFixed(2)}cqw`;
      }
    }
    function fitCurrentSlide() {
      const slide = deck.slides[deck.current];
      const height = deck.root.clientHeight;
      fit(slide.querySelector('.winner-name'), 7.5, 3.4, height * .27);
      fit(slide.querySelector('.winner-reason'), 1.8, 1.65, height * .18);
      fit(slide.querySelector('.featured-comment'), 3.7, 2, height * .41);
      slide.querySelectorAll('.final-name').forEach((element) => fit(element, 3, 2, height * .18));
    }
    function renderContent() {
      document.querySelectorAll('[data-field][data-person]').forEach((element) => {
        if (!element.dataset.emptyValue) element.dataset.emptyValue = element.textContent;
        const value = content.winners[Number(element.dataset.person)]?.[element.dataset.field] || '';
        element.textContent = value || element.dataset.emptyValue;
      });
      document.querySelectorAll('[data-event-label]').forEach((element) => { element.textContent = content.eventLabel; });
      fitCurrentSlide();
    }
    function revealControls() {
      body.classList.remove('hide-controls');
      clearTimeout(controlTimer);
      if (state.running && !dialog.open) controlTimer = setTimeout(() => body.classList.add('hide-controls'), 2600);
    }
    function updateStatus(message) {
      body.classList.toggle('awards-playing', state.running);
      body.classList.toggle('awards-paused', !state.running && !state.ready && !state.ended);
      body.classList.toggle('awards-ready', state.ready);
      body.classList.toggle('awards-ended', state.ended);
      toggleButton.textContent = state.running ? '일시정지' : state.ended ? '다시 재생' : state.ready ? '자동 재생' : '계속 재생';
      toggleButton.setAttribute('aria-label', state.running ? '자동 재생 일시정지' : '자동 재생 시작');
      soundButton.textContent = content.sound ? '소리 켜짐' : '소리 꺼짐';
      soundButton.setAttribute('aria-pressed', String(content.sound));
      status.textContent = message || (state.running ? '자동 재생 중' : state.ended ? '발표 완료' : state.ready ? '발표 대기' : '일시정지');
      progress.style.width = `${Math.min(100, elapsedTotal() / totalDuration() * 100)}%`;
    }
    function cueOnce(key, kind) { if (!state.cues.has(key)) { state.cues.add(key); audio.cue(kind); } }
    function updateScene() {
      const slide = deck.slides[deck.current];
      const kind = slide.dataset.kind;
      if (kind === 'suspense') {
        const remaining = Math.ceil((duration(slide) - state.elapsed) / 1000);
        const value = remaining <= 3 ? String(Math.max(1, remaining)) : '?';
        const counter = slide.querySelector('.countdown');
        if (counter.textContent !== value) {
          counter.textContent = value;
          counter.classList.remove('is-ticking');
          void counter.offsetWidth;
          counter.classList.add('is-ticking');
        }
        if (state.running) {
          cueOnce('suspense', 'suspense');
          if (remaining <= 3) cueOnce(`count-${remaining}`, 'count');
        }
      } else if (state.running && ['opening', 'reveal'].includes(kind)) cueOnce(kind, kind);
      progress.style.width = `${Math.min(100, elapsedTotal() / totalDuration() * 100)}%`;
    }
    function schedule() { if (state.running && state.raf === null) state.raf = requestAnimationFrame(frame); }
    function frame(now) {
      state.raf = null;
      if (!state.running || state.print) return;
      state.elapsed += Math.max(0, now - state.lastTime);
      state.lastTime = now;
      updateScene();
      const length = duration(deck.slides[deck.current]);
      if (length && state.elapsed >= length) deck.next();
      schedule();
    }
    function pause(message) {
      if (state.running) state.elapsed = Math.min(duration(deck.slides[deck.current]), state.elapsed + Math.max(0, performance.now() - state.lastTime));
      state.running = false;
      if (state.raf !== null) cancelAnimationFrame(state.raf);
      state.raf = null;
      audio.stop();
      updateStatus(message);
      revealControls();
    }
    async function play({ restart = false, silent = false } = {}) {
      if (state.print || dialog.open) return;
      if (silent) { content.sound = false; audio.setMuted(true); }
      if (restart || state.ended) { pause(); deck.go(0); state.elapsed = 0; state.cues.clear(); }
      if (content.sound) await audio.unlock();
      state.ready = false; state.ended = false; state.running = true;
      state.lastTime = performance.now();
      body.classList.remove('awards-preview');
      updateStatus(); updateScene(); revealControls(); schedule();
    }
    function changeSlide() {
      if (state.print) return;
      audio.stop();
      state.elapsed = 0; state.lastTime = performance.now(); state.cues.clear();
      state.ready = state.ready && deck.current === 0;
      state.ended = deck.current === deck.slides.length - 1;
      body.classList.toggle('awards-preview', !state.running && !state.ready);
      if (state.ended) {
        if (state.running) audio.cue('finale');
        state.running = false;
        if (state.raf !== null) cancelAnimationFrame(state.raf);
        state.raf = null;
        revealControls();
      }
      updateStatus(); updateScene();
      requestAnimationFrame(fitCurrentSlide);
    }
    async function toggleSound() {
      content.sound = !content.sound;
      audio.setMuted(!content.sound);
      if (content.sound) { await audio.unlock(); if (state.running) audio.cue('count'); }
      updateStatus(); revealControls();
    }

    function fillForm(value) {
      form.elements.eventLabel.value = value.eventLabel;
      value.winners.forEach((winner, i) => Object.keys(LIMITS).forEach((field) => { form.elements[`winner-${i}-${field}`].value = winner[field]; }));
      form.elements.revealDuration.value = value.timings.reveal;
      form.elements.evidenceDuration.value = value.timings.evidence;
      updateDurationLabel();
    }
    function readForm() {
      return normalize({ ...content, eventLabel: form.elements.eventLabel.value,
        winners: Array.from({ length: 3 }, (_, i) => Object.fromEntries(Object.keys(LIMITS).map((field) => [field, form.elements[`winner-${i}-${field}`].value]))),
        timings: { ...content.timings, reveal: form.elements.revealDuration.value, evidence: form.elements.evidenceDuration.value }
      });
    }
    function updateDurationLabel() { const next = readForm(); document.querySelector('[data-total-duration]').textContent = readableTime(14 + 3 * (6 + next.timings.reveal + next.timings.evidence)); }
    function openEditor() {
      pause(); fillForm(content);
      document.querySelector('[data-editor-message]').textContent = '';
      dialog.showModal(); revealControls();
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      content = readForm(); renderContent();
      let message = '내용을 적용했습니다';
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(content)); } catch { message = '내용을 적용했습니다. 이 환경에서는 브라우저 저장이 제한됩니다. 내용 파일도 저장해 주세요.'; }
      dialog.close(); updateStatus(message); revealControls();
    });
    form.addEventListener('input', updateDurationLabel);
    document.querySelector('[data-editor-close]').addEventListener('click', () => dialog.close());
    document.querySelector('[data-config-export]').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(readForm(), null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'comment-awards-content.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    });
    document.querySelector('[data-config-import]').addEventListener('click', () => document.querySelector('[data-config-file]').click());
    document.querySelector('[data-config-file]').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const message = document.querySelector('[data-editor-message]');
      try {
        if (file.size > 200_000) throw new Error('내용 파일이 너무 큽니다.');
        const value = JSON.parse(await file.text());
        if (value.schemaVersion !== 1 || !Array.isArray(value.winners) || value.winners.length !== 3 || value.winners.some((winner) => !winner || typeof winner !== 'object' || Array.isArray(winner))) throw new Error('이 발표의 내용 파일이 아닙니다.');
        fillForm(normalize(value)); message.textContent = '불러왔습니다. 내용을 확인한 뒤 적용을 눌러 주세요.';
      } catch (error) { message.textContent = `불러오지 못했습니다. ${error.message}`; }
      event.target.value = '';
    });

    window.addEventListener('deck:slidechange', changeSlide);
    document.querySelector('[data-awards-start]').addEventListener('click', () => play({ restart: true }));
    toggleButton.addEventListener('click', () => state.running ? pause() : play());
    document.querySelector('[data-awards-restart]').addEventListener('click', () => play({ restart: true }));
    soundButton.addEventListener('click', toggleSound);
    document.querySelector('[data-awards-fullscreen]').addEventListener('click', () => deck.toggleFullscreen());
    document.querySelector('[data-awards-edit]').addEventListener('click', openEditor);
    document.addEventListener('keydown', (event) => {
      if (dialog.open || state.print || event.target instanceof HTMLElement && event.target.matches('input, textarea, select, button, a, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (![' ', 'r', 'm', 'e'].includes(key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (key === ' ') state.running ? pause() : play();
      if (key === 'r') play({ restart: true });
      if (key === 'm') toggleSound();
      if (key === 'e') openEditor();
    }, true);
    document.addEventListener('pointermove', revealControls, { passive: true });
    document.addEventListener('focusin', revealControls);
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.running) pause('다른 화면으로 이동해 일시정지했습니다'); });
    window.addEventListener('resize', fitCurrentSlide);
    window.addEventListener('deck:prepareprint', () => { pause(); state.print = true; document.querySelectorAll('.countdown').forEach((node) => { node.textContent = '3'; }); });
    window.addEventListener('afterprint', () => { state.print = deck.isPrint; if (!state.print) changeSlide(); });
    document.fonts.ready.then(fitCurrentSlide);

    // 발표 전용 제어와 독립된 로컬 검사에서 사용하는 읽기 인터페이스.
    window.commentAwards = {
      play, pause,
      getState: () => ({ running: state.running, ready: state.ready, ended: state.ended, index: deck.current, elapsed: state.elapsed, totalDuration: totalDuration(), sound: content.sound, audioState: audio.context?.state || 'not-started', audioCueCount: audio.cueCount, audioLevel: audio.level() })
    };
    renderContent(); changeSlide();
    if (new URLSearchParams(location.search).get('autoplay') === '1' && !state.print) play({ silent: true });
  });
})();
