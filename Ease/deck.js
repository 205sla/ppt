(() => {
    'use strict';

    const ease = {
        linear: (t) => t,
        easeIn: (t) => t * t,
        easeOut: (t) => 1 - (1 - t) * (1 - t),
        easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
    };
    const clamp01 = (value) => Math.min(1, Math.max(0, value));
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animations = new Set();

    function animate(duration, draw, complete) {
        let frame = 0;
        const started = performance.now();
        const stop = () => {
            cancelAnimationFrame(frame);
            animations.delete(stop);
        };
        animations.add(stop);

        const tick = (now) => {
            const t = reducedMotion ? 1 : clamp01((now - started) / duration);
            draw(t);
            if (t < 1) frame = requestAnimationFrame(tick);
            else {
                animations.delete(stop);
                complete?.();
            }
        };
        frame = requestAnimationFrame(tick);
        return stop;
    }

    function stopAnimations() {
        [...animations].forEach((stop) => stop());
    }

    function initRace(board) {
        const lanes = [...board.querySelectorAll('.lane')];
        const timeOutput = board.querySelector('[data-race-time]');
        const range = board.querySelector('[data-race-range]');
        let stop = null;

        const setTime = (value) => {
            const t = clamp01(Number(value));
            lanes.forEach((lane) => {
                const p = ease[lane.dataset.ease](t);
                lane.querySelector('.runner').style.left = `${p * 100}%`;
                const output = lane.querySelector('.lane-value');
                if (output) output.textContent = `${Math.round(p * 100)}%`;
            });
            if (timeOutput) timeOutput.textContent = `t = ${t.toFixed(2)}`;
            if (range) range.value = String(t);
        };

        const play = () => {
            stop?.();
            setTime(0);
            stop = animate(Number(board.dataset.duration || 2800), setTime);
        };

        board.querySelector('[data-action="play"]')?.addEventListener('click', play);
        board.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
            stop?.();
            setTime(Number(board.dataset.initial || 0));
        });
        range?.addEventListener('input', (event) => {
            stop?.();
            setTime(event.target.value);
        });
        setTime(Number(board.dataset.initial || 0));

        return {
            root: board,
            reset: () => {
                stop?.();
                setTime(Number(board.dataset.initial || 0));
            },
            activate: () => {
                if (board.dataset.autoplay === 'true') setTimeout(play, 360);
            },
        };
    }

    function initDotTrail(root) {
        const line = root.querySelector('[data-dot-line]');
        const buttons = [...root.querySelectorAll('[data-dot-ease]')];
        const label = root.querySelector('[data-dot-label]');
        const descriptions = {
            linear: '간격이 같다 → 속도가 일정하다',
            easeIn: '앞쪽 간격이 좁다 → 천천히 출발한다',
            easeOut: '뒤쪽 간격이 좁다 → 천천히 도착한다',
            easeInOut: '양끝 간격이 좁다 → 출발·도착이 부드럽다',
        };
        const dots = Array.from({ length: 11 }, (_, index) => {
            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.setAttribute('aria-hidden', 'true');
            dot.dataset.t = String(index / 10);
            line.append(dot);
            return dot;
        });

        const select = (name) => {
            dots.forEach((dot) => {
                dot.style.left = `${ease[name](Number(dot.dataset.t)) * 100}%`;
            });
            buttons.forEach((button) => button.dataset.active = String(button.dataset.dotEase === name));
            label.textContent = descriptions[name];
        };

        buttons.forEach((button) => button.addEventListener('click', () => select(button.dataset.dotEase)));
        select('linear');
    }

    function initNormalizer(root) {
        const gauge = root.querySelector('.t-gauge');
        const output = root.querySelector('[data-normalizer-output]');
        const durationButtons = [...root.querySelectorAll('[data-duration]')];
        let duration = 2000;
        let stop = null;

        const setTime = (t) => {
            gauge.style.setProperty('--fill', `${t * 100}%`);
            output.textContent = t.toFixed(2);
        };
        const chooseDuration = (seconds) => {
            duration = Number(seconds) * 1000;
            durationButtons.forEach((button) => button.dataset.active = String(button.dataset.duration === String(seconds)));
            setTime(0);
        };
        const play = () => {
            stop?.();
            setTime(0);
            stop = animate(duration, setTime);
        };

        durationButtons.forEach((button) => button.addEventListener('click', () => chooseDuration(button.dataset.duration)));
        root.querySelector('[data-normalizer-play]')?.addEventListener('click', play);
        chooseDuration('2');
    }

    function initPosition(root) {
        const range = root.querySelector('[data-position-range]');
        const ball = root.querySelector('.position-ball');
        const output = root.querySelector('[data-position-output]');
        const start = -120;
        const end = 230;

        const setProgress = (value) => {
            const p = clamp01(Number(value));
            const x = start + (end - start) * p;
            ball.style.left = `${p * 100}%`;
            output.textContent = `x = -120 + 350 × ${p.toFixed(2)} = ${x.toFixed(1)}`;
        };
        range.addEventListener('input', (event) => setProgress(event.target.value));
        setProgress(range.value);
    }

    function initCurve(layout) {
        const type = layout.dataset.easing;
        const svg = layout.querySelector('.curve-svg');
        const path = svg.querySelector('.curve-line');
        const dot = svg.querySelector('.curve-dot');
        const guideX = svg.querySelector('[data-guide-x]');
        const guideY = svg.querySelector('[data-guide-y]');
        const range = layout.querySelector('[data-curve-range]');
        const tOutput = layout.querySelector('[data-curve-t]');
        const pOutput = layout.querySelector('[data-curve-p]');
        const left = 48;
        const right = 360;
        const top = 28;
        const bottom = 330;
        let stop = null;

        const pointAt = (t) => ({
            x: left + (right - left) * t,
            y: bottom - (bottom - top) * ease[type](t),
        });
        const points = Array.from({ length: 81 }, (_, index) => pointAt(index / 80));
        path.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '));

        const setTime = (value) => {
            const t = clamp01(Number(value));
            const p = ease[type](t);
            const point = pointAt(t);
            dot.setAttribute('cx', point.x);
            dot.setAttribute('cy', point.y);
            guideX.setAttribute('x1', point.x);
            guideX.setAttribute('x2', point.x);
            guideX.setAttribute('y1', point.y);
            guideX.setAttribute('y2', bottom);
            guideY.setAttribute('x1', left);
            guideY.setAttribute('x2', point.x);
            guideY.setAttribute('y1', point.y);
            guideY.setAttribute('y2', point.y);
            range.value = String(t);
            tOutput.textContent = t.toFixed(2);
            pOutput.textContent = p.toFixed(2);
        };
        const play = () => {
            stop?.();
            setTime(0);
            stop = animate(2400, setTime);
        };

        range.addEventListener('input', (event) => {
            stop?.();
            setTime(event.target.value);
        });
        layout.querySelector('[data-curve-play]')?.addEventListener('click', play);
        setTime(Number(range.value || 0.5));

        return { root: layout, reset: () => { stop?.(); setTime(0.5); } };
    }

    function initFormulaChoice(root) {
        const buttons = [...root.querySelectorAll('[data-formula-choice]')];
        const preview = root.querySelector('[data-choice-preview]');
        const messages = {
            linear: '연습용: 먼저 p=t로 전체 구조가 움직이는지 확인하세요.',
            easeIn: '무거운 물체가 출발하거나 떨어지기 시작할 때 잘 어울려요.',
            easeOut: '버튼·창이 나타나며 자연스럽게 멈출 때 잘 어울려요.',
            easeInOut: '카메라나 캐릭터가 이동할 때 가장 무난하게 부드러워요.',
        };
        buttons.forEach((button) => button.addEventListener('click', () => {
            buttons.forEach((item) => item.dataset.active = String(item === button));
            preview.textContent = messages[button.dataset.formulaChoice];
        }));
        buttons[0]?.click();
    }

    function initMatching(root) {
        root.querySelectorAll('.match-row').forEach((row) => {
            const feedback = row.querySelector('.match-feedback');
            row.querySelectorAll('[data-match-choice]').forEach((button) => {
                button.addEventListener('click', () => {
                    row.querySelectorAll('[data-match-choice]').forEach((item) => item.classList.remove('is-correct', 'is-wrong'));
                    const correct = button.dataset.matchChoice === row.dataset.correct;
                    button.classList.add(correct ? 'is-correct' : 'is-wrong');
                    feedback.textContent = correct ? row.dataset.success : '느낌을 다시 떠올려 보세요.';
                });
            });
        });
    }

    function initDebug(root) {
        const modeButtons = [...root.querySelectorAll('[data-debug-mode]')];
        const status = root.querySelector('[data-debug-status]');
        let restartTimer = 0;
        const run = () => {
            clearTimeout(restartTimer);
            root.classList.remove('is-playing');
            void root.offsetWidth;
            root.classList.add('is-playing');
            restartTimer = window.setTimeout(() => root.classList.remove('is-playing'), 2150);
        };
        const setMode = (mode) => {
            const fixed = mode === 'fixed';
            root.classList.toggle('is-fixed', fixed);
            modeButtons.forEach((button) => button.dataset.active = String(button.dataset.debugMode === mode));
            status.textContent = fixed ? '마지막에 t=1을 한 번 더 계산 → 정확히 도착' : '40번 직전에 종료 → 도착점에서 살짝 멈춤';
            run();
        };
        modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.debugMode)));
        root.querySelector('[data-debug-replay]')?.addEventListener('click', run);
        setMode('bug');
    }

    function initTimer(root) {
        const output = root.querySelector('output');
        const startButton = root.querySelector('[data-timer-start]');
        const resetButton = root.querySelector('[data-timer-reset]');
        const total = Number(root.dataset.minutes || 10) * 60;
        let remaining = total;
        let interval = 0;

        const render = () => {
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            output.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };
        const stop = () => {
            clearInterval(interval);
            interval = 0;
            startButton.textContent = '시작';
        };
        startButton.addEventListener('click', () => {
            if (interval) {
                stop();
                return;
            }
            startButton.textContent = '일시정지';
            interval = window.setInterval(() => {
                remaining = Math.max(0, remaining - 1);
                render();
                if (!remaining) stop();
            }, 1000);
        });
        resetButton.addEventListener('click', () => {
            stop();
            remaining = total;
            render();
        });
        render();
    }

    const raceComponents = [...document.querySelectorAll('[data-race]')].map(initRace);
    document.querySelector('[data-race-play-proxy]')?.addEventListener('click', () => {
        document.querySelector('[data-race][data-autoplay="true"] [data-action="play"]')?.click();
    });
    document.querySelector('[data-race-reset-proxy]')?.addEventListener('click', () => {
        document.querySelector('[data-race][data-autoplay="true"] [data-action="reset"]')?.click();
    });
    document.querySelectorAll('[data-dot-trail]').forEach(initDotTrail);
    document.querySelectorAll('[data-normalizer]').forEach(initNormalizer);
    document.querySelectorAll('[data-position-demo]').forEach(initPosition);
    const curveComponents = [...document.querySelectorAll('.easing-layout[data-easing]')].map(initCurve);
    document.querySelectorAll('[data-formula-picker]').forEach(initFormulaChoice);
    document.querySelectorAll('[data-matching]').forEach(initMatching);
    document.querySelectorAll('[data-debug-demo]').forEach(initDebug);
    document.querySelectorAll('[data-timer]').forEach(initTimer);

    window.addEventListener('deck:slidechange', (event) => {
        stopAnimations();
        const activeSlide = event.detail.slide;
        [...raceComponents, ...curveComponents].forEach((component) => {
            if (component.root.closest('.slide') !== activeSlide) component.reset?.();
            else component.activate?.();
        });
    });
})();
