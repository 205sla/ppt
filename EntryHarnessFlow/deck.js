(() => {
    'use strict';
    // 장면 단계: data-scene 슬라이드마다 단계 버튼을 붙이고, data-show 규칙으로 요소를 켜고 끕니다.
    // 현재 장의 단계만 자동 재생하고, 페이지는 발표자가 스페이스·방향키로 넘깁니다.
    // CSS 움직임이 끝날 시간을 둔 뒤 다음 단계를 표시합니다. 마지막 단계는 그대로 유지합니다.
    const params = new URLSearchParams(location.search);
    const RAIL = [['명세 작성', 'ai'], ['정적 검사', 'tool'], ['작품 생성', 'tool'], ['실행·관찰', 'tool'], ['작품별 검사', 'tool'], ['피드백', 'ai']];
    const DSL = new Set(['if_', 'eq', 'v', 'anyKey', 'inc', 'mul', 'sub', 'g', 's', 'isPressed']);
    const scenes = [];
    const sceneOf = new Map();
    let deck = null;
    let printing = params.has('print');
    let saved = null;
    const STEP_MS = 4000;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let timer = null;

    function activeScene() { return sceneOf.get(deck.slides[deck.current]); }

    function stopPlayback() {
        clearTimeout(timer);
        timer = null;
    }

    function scheduleStep() {
        stopPlayback();
        const scene = activeScene();
        if (printing || document.hidden || reducedMotion.matches || !scene || scene.step === scene.labels.length - 1) return;
        timer = setTimeout(() => {
            timer = null;
            if (!printing && !document.hidden && activeScene() === scene) setStep(scene, scene.step + 1);
        }, STEP_MS);
    }

    function startScene() {
        stopPlayback();
        const scene = activeScene();
        if (!scene || printing) return;
        if (reducedMotion.matches) setStep(scene, scene.labels.length - 1);
        else replay(scene);
    }

    // "2" → 2단계부터, "=2" → 2단계에서만, "<=1" → 1단계까지
    function rule(text) {
        const match = text.trim().match(/^(<=|=)?\s*(\d+)$/);
        if (!match) throw new Error('data-show 규칙 오류: ' + text);
        const n = Number(match[2]);
        if (match[1] === '=') return { test: (k) => k === n, now: (k) => k === n };
        if (match[1] === '<=') return { test: (k) => k <= n, now: () => false };
        return { test: (k) => k >= n, now: (k) => k === n };
    }

    function buildRail(rail) {
        const current = Number(rail.dataset.rail);
        rail.setAttribute('aria-label', current ? `제작 과정 6단계 중 ${current}단계` : '제작 과정 6단계');
        rail.innerHTML = RAIL.map(([name, who], i) => {
            const n = i + 1;
            const state = !current ? 'next' : n < current ? 'past' : n === current ? 'now' : 'next';
            return `<li class="${who} ${state}" data-rail-n="${n}"${state === 'now' ? ' aria-current="step"' : ''}><span class="n">${n}</span>${name}</li>`;
        }).join('');
    }

    function tokenize(line) {
        const out = [];
        const pattern = /('[^']*')|([A-Za-z_][A-Za-z0-9_]*)|(-?\d+(?:\.\d+)?)|(\s+)|(.)/g;
        let match;
        while ((match = pattern.exec(line))) {
            if (match[1]) out.push([match[1], 'str']);
            else if (match[2]) out.push([match[2], DSL.has(match[2]) ? 'dsl' : /^[A-Z]+$/.test(match[2]) ? 'con' : 'id']);
            else if (match[3]) out.push([match[3], 'num']);
            else if (match[4]) out.push([match[4], '']);
            else out.push([match[5], 'pun']);
        }
        return out;
    }

    function highlightCode(pre) {
        pre.querySelectorAll('.ln').forEach((line) => {
            const fragment = document.createDocumentFragment();
            for (const [text, kind] of tokenize(line.textContent)) {
                if (!kind) { fragment.append(text); continue; }
                const span = document.createElement('span');
                span.className = 't-' + kind;
                span.textContent = text;
                fragment.append(span);
            }
            line.replaceChildren(fragment);
        });
    }

    function typewriter(element) {
        const text = element.textContent;
        element.setAttribute('aria-label', text);
        element.replaceChildren(...[...text].map((char, i) => {
            const span = document.createElement('span');
            span.className = 'ch';
            span.style.setProperty('--i', String(i));
            span.setAttribute('aria-hidden', 'true');
            span.textContent = char;
            return span;
        }));
        const caret = document.createElement('span');
        caret.className = 'caret';
        caret.setAttribute('aria-hidden', 'true');
        element.append(caret);
    }

    function buildBar(scene) {
        const bar = document.createElement('div');
        bar.className = 'step-bar';
        bar.setAttribute('role', 'group');
        bar.setAttribute('aria-label', '장면 단계');
        bar.innerHTML = '<button type="button" class="step-btn" data-step-prev aria-label="이전 단계" title="이전 단계"></button>'
            + '<span class="step-status" aria-live="polite"><span class="step-count" data-step-count></span><span class="step-name" data-step-name></span></span>'
            + '<button type="button" class="step-btn next" data-step-next aria-label="다음 단계" title="다음 단계"></button>'
            + '<button type="button" class="step-btn" data-step-replay aria-label="처음부터 다시" title="처음부터 다시">↺</button>';
        scene.slide.append(bar);
        const press = (handler) => (event) => {
            handler();
            // 마우스·터치로 누른 버튼은 포커스를 놓아 ← → 키가 계속 슬라이드를 넘기게 합니다.
            if (event.detail > 0) event.currentTarget.blur();
        };
        bar.querySelector('[data-step-prev]').addEventListener('click', press(() => setStep(scene, scene.step - 1)));
        bar.querySelector('[data-step-next]').addEventListener('click', press(() => setStep(scene, scene.step + 1)));
        bar.querySelector('[data-step-replay]').addEventListener('click', press(() => replay(scene)));
        scene.slide.querySelectorAll('[data-goto-step]').forEach((button) => {
            button.addEventListener('click', press(() => setStep(scene, Number(button.dataset.gotoStep))));
        });
        return {
            prev: bar.querySelector('[data-step-prev]'),
            next: bar.querySelector('[data-step-next]'),
            count: bar.querySelector('[data-step-count]'),
            name: bar.querySelector('[data-step-name]'),
        };
    }

    function setStep(scene, value) {
        if (!scene) return;
        const last = scene.labels.length - 1;
        const k = Math.min(last, Math.max(0, Math.round(value)));
        scene.step = k;
        scene.slide.dataset.step = String(k);
        for (const item of scene.items) {
            item.el.classList.toggle('is-on', item.rule.test(k));
            item.el.classList.toggle('is-now', item.rule.now(k));
        }
        for (const el of scene.nows) el.classList.toggle('is-now', el.dataset.now.split(/\s+/).map(Number).includes(k));
        for (const button of scene.gotos) button.setAttribute('aria-pressed', String(Number(button.dataset.gotoStep) === k || k === last));
        if (scene.follow) {
            const hits = (scene.slide.querySelector('[data-rail-hit].is-now')?.dataset.railHit || '').split(/\s+/).filter(Boolean);
            scene.follow.querySelectorAll('li').forEach((li) => li.classList.toggle('hit', hits.includes(li.dataset.railN)));
        }
        scene.bar.count.textContent = `${k + 1} / ${last + 1}`;
        scene.bar.name.textContent = scene.labels[k];
        scene.bar.prev.disabled = k === 0;
        scene.bar.next.disabled = k === last;
        if (scene === activeScene()) scheduleStep();
    }

    // 장면을 0단계로 되돌리고 이 슬라이드의 CSS 애니메이션(타자·하이라이트 등)을 처음부터 다시 재생합니다.
    function replay(scene) {
        setStep(scene, 0);
        scene.slide.getAnimations({ subtree: true }).forEach((animation) => {
            if (typeof CSSAnimation !== 'undefined' && !(animation instanceof CSSAnimation)) return;
            animation.cancel();
            animation.play();
        });
    }

    function preparePrint() {
        if (!printing && !saved) saved = new Map(scenes.map((scene) => [scene, scene.step]));
        printing = true;
        stopPlayback();
        // PDF에는 각 장면의 마지막(완성) 단계를 싣습니다. 여러 번 호출해도 결과가 같습니다.
        for (const scene of scenes) setStep(scene, scene.labels.length - 1);
    }

    function init() {
        deck = window.ppt205Deck;
        if (!deck) return;
        document.querySelectorAll('.rail[data-rail]').forEach(buildRail);
        document.querySelectorAll('pre.code').forEach(highlightCode);
        document.querySelectorAll('[data-typewriter]').forEach(typewriter);
        document.querySelectorAll('.slide[data-scene]').forEach((slide) => {
            const scene = {
                name: slide.dataset.scene,
                slide,
                labels: slide.dataset.steps.split('|'),
                step: 0,
                items: [...slide.querySelectorAll('[data-show]')].map((el) => ({ el, rule: rule(el.dataset.show) })),
                nows: [...slide.querySelectorAll('[data-now]')],
                gotos: [...slide.querySelectorAll('[data-goto-step]')],
                follow: slide.querySelector('.rail[data-rail-follow]'),
            };
            scene.bar = buildBar(scene);
            scenes.push(scene);
            sceneOf.set(slide, scene);
            setStep(scene, 0);
        });

        window.addEventListener('deck:slidechange', ({ detail }) => {
            if (printing || detail.previousSlide === detail.slide) return;
            startScene();
        });

        // 이 자료에서만 네 방향키와 스페이스를 페이지 이동으로 통일합니다.
        // 공통 처리 전에 한 번만 실행하므로 버튼에 포커스가 남아도 같게 동작합니다. Enter·Tab은 그대로 둡니다.
        const PRESENTER_KEYS = { ' ': 'next', arrowright: 'next', arrowdown: 'next', pagedown: 'next', arrowleft: 'previous', arrowup: 'previous', pageup: 'previous', home: 'first', end: 'last', n: 'notes', f: 'fullscreen' };
        const presenterKey = (event) => {
            let action = PRESENTER_KEYS[event.key.toLowerCase()];
            if (!action) return;
            event.stopPropagation();
            const target = event.target;
            if (printing || event.altKey || event.ctrlKey || event.metaKey
                || (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select')))) return;
            event.preventDefault();
            if (event.repeat) return;
            if (event.key === ' ' && event.shiftKey) action = 'previous';
            if (action === 'next') deck.next();
            else if (action === 'previous') deck.previous();
            else if (action === 'first') deck.go(0);
            else if (action === 'last') deck.go(deck.slides.length - 1);
            else if (action === 'notes') deck.toggleNotes();
            else deck.toggleFullscreen();
        };
        document.addEventListener('keydown', presenterKey, true);
        document.addEventListener('visibilitychange', scheduleStep);
        window.addEventListener('pagehide', stopPlayback);
        window.addEventListener('pageshow', scheduleStep);
        reducedMotion.addEventListener('change', () => {
            if (printing) return;
            if (reducedMotion.matches && activeScene()) setStep(activeScene(), activeScene().labels.length - 1);
            scheduleStep();
        });

        window.addEventListener('deck:prepareprint', preparePrint);
        window.addEventListener('afterprint', () => {
            if (params.has('print')) return;
            printing = false;
            if (saved) saved.forEach((step, scene) => setStep(scene, step));
            saved = null;
            scheduleStep();
        });
        // 인쇄 주소(?print)에서는 공통 deck.js가 이 스크립트보다 먼저 인쇄 준비를 마치므로 여기서 한 번 더 맞춥니다.
        if (printing) preparePrint();
        else startScene();

        window.entryHarnessFlow = {
            scenes: () => scenes.map((scene) => ({ name: scene.name, index: deck.slides.indexOf(scene.slide), steps: scene.labels.length, labels: [...scene.labels] })),
            state: () => ({ current: deck.current, printing, steps: Object.fromEntries(scenes.map((scene) => [scene.name, scene.step])) }),
            setStep: (name, step) => setStep(scenes.find((scene) => scene.name === name), step),
        };
    }

    // 공통 deck.js의 DOMContentLoaded 처리(Deck 생성)가 먼저 끝난 뒤 실행됩니다.
    window.addEventListener('DOMContentLoaded', init);
})();
