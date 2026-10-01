(() => {
    'use strict';
    // The archived CoopAIFlow step-player pattern is reused with the current
    // coordinator contract. This is a self-contained explanation, not an API demo.
    const sequenceCaptions = [
        '1 / 6 · 대화에서 나온 행동 요청을 사용자가 확정',
        '2 / 6 · 판단 시점의 관측 가능한 게임 상태 조회',
        '3 / 6 · 게임의 사실과 실행 가능한 후보 수신',
        '4 / 6 · 조정기가 지시·대화·기억·관측을 하나로 구성',
        '5 / 6 · 행동 AI가 후보 중 행동을 선택하거나 질문',
        '6 / 6 · 응답 검사·재관측 후 실행기로 전달'
    ];
    const frames = [
        { phase:'접수', caption:'실행 명령을 받았지만 아직 요청을 완료한 것은 아닙니다.', ai:[95,166], player:[525,250], held:false, open:false },
        { phase:'이동 중', caption:'파란 발판으로 이동 중입니다. 도착 여부는 엔진이 보고합니다.', ai:[237,166], player:[525,250], held:false, open:false },
        { phase:'발판 유지', caption:'발판 접촉을 확인했습니다. 플레이어는 아직 통과 전입니다.', ai:[385,166], player:[525,250], held:true, open:true },
        { phase:'통과 대기', caption:'발판을 밟은 상태로 기다립니다. 작업 상태는 계속 진행 중입니다.', ai:[385,166], player:[551,166], held:true, open:true },
        { phase:'완료', caption:'플레이어 통과와 통과까지의 발판 유지가 함께 확인되어 완료합니다.', ai:[385,166], player:[669,166], held:true, open:true }
    ];
    let sequenceIndex = 0;
    let puzzleIndex = 0;
    let timer = null;
    let playing = null;
    let ready = false;
    let printSnapshot = null;

    const q = (selector) => document.querySelector(selector);
    function updateButtons() {
        for (const kind of ['sequence','puzzle']) {
            const index = kind === 'sequence' ? sequenceIndex : puzzleIndex;
            const length = kind === 'sequence' ? sequenceCaptions.length : frames.length;
            q(`[data-${kind}="play"]`).textContent = playing === kind ? '일시 정지' : kind === 'sequence' ? '순서 재생' : '시연 재생';
            q(`[data-${kind}="play"]`).setAttribute('aria-pressed', String(playing === kind));
            q(`[data-${kind}="previous"]`).disabled = index === 0;
            q(`[data-${kind}="next"]`).disabled = index === length - 1;
        }
    }
    function stop() {
        if (timer !== null) clearInterval(timer);
        timer = null;
        playing = null;
        if (ready) updateButtons();
    }
    function renderSequence(index, all = false) {
        sequenceIndex = Math.min(Math.max(index, 0), sequenceCaptions.length - 1);
        q('#sequence-slide').dataset.sequenceState = String(sequenceIndex);
        q('.sequence-chart').classList.toggle('all-steps', all);
        document.querySelectorAll('[data-sequence-step]').forEach((step) => step.classList.toggle('is-current', Number(step.dataset.sequenceStep) === sequenceIndex && !all));
        q('[data-sequence-caption]').textContent = all ? '확정 지시 → 관측 → 맥락 구성 → 행동 선택 → 검사·실행' : sequenceCaptions[sequenceIndex];
        updateButtons();
    }
    function renderPuzzle(index) {
        puzzleIndex = Math.min(Math.max(index, 0), frames.length - 1);
        const frame = frames[puzzleIndex];
        q('#puzzle-slide').dataset.puzzleState = String(puzzleIndex);
        q('[data-ai-token]').setAttribute('transform', `translate(${frame.ai.join(' ')})`);
        q('[data-player-token]').setAttribute('transform', `translate(${frame.player.join(' ')})`);
        q('.blue-plate').classList.toggle('is-held', frame.held);
        q('.puzzle-door').classList.toggle('is-open', frame.open);
        q('[data-puzzle-phase]').textContent = frame.phase;
        q('[data-puzzle-caption]').textContent = frame.caption;
        document.querySelectorAll('[data-event]').forEach((event) => {
            const eventIndex = Number(event.dataset.event);
            event.classList.toggle('is-current', eventIndex === puzzleIndex);
            event.classList.toggle('is-done', eventIndex < puzzleIndex);
        });
        updateButtons();
    }
    function control(kind, action) {
        const length = kind === 'sequence' ? sequenceCaptions.length : frames.length;
        const getIndex = () => kind === 'sequence' ? sequenceIndex : puzzleIndex;
        const render = kind === 'sequence' ? renderSequence : renderPuzzle;
        if (action === 'play') {
            const wasPlaying = playing === kind;
            stop();
            if (wasPlaying) return;
            if (getIndex() === length - 1) render(0);
            playing = kind;
            updateButtons();
            timer = setInterval(() => {
                render(getIndex() + 1);
                if (getIndex() === length - 1) stop();
            }, 1500);
            return;
        }
        stop();
        if (action === 'reset') render(0);
        else render(getIndex() + (action === 'next' ? 1 : -1));
    }
    function preparePrint() {
        if (!ready) return;
        // Both shared print setup and the exporter call this event. Save once.
        if (printSnapshot === null) printSnapshot = { sequenceIndex, puzzleIndex };
        stop();
        renderSequence(5, true);
        renderPuzzle(3);
    }
    window.addEventListener('deck:slidechange', () => stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('deck:prepareprint', preparePrint);
    window.addEventListener('afterprint', () => {
        if (!ready || printSnapshot === null || window.ppt205Deck?.isPrint) return;
        const saved = printSnapshot;
        printSnapshot = null;
        renderSequence(saved.sequenceIndex);
        renderPuzzle(saved.puzzleIndex);
    });
    function init() {
        if (ready) return;
        ready = true;
        for (const kind of ['sequence','puzzle']) {
            document.querySelectorAll(`[data-${kind}]`).forEach((button) => button.addEventListener('click', () => control(kind, button.dataset[kind])));
        }
        renderSequence(0);
        renderPuzzle(0);
        if (window.ppt205Deck?.isPrint || document.body.classList.contains('print-mode')) preparePrint();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
