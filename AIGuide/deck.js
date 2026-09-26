(() => {
    'use strict';
    // data-from="n": n단계부터 보임 · data-at="a-b": a~b단계에만 보임 · data-lit="a-b": 해당 단계에 강조
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const demos = new Map();
    let printing = false;

    const inRange = (spec, frame) => {
        const [start, end = start] = spec.split('-').map(Number);
        return frame >= start && frame <= end;
    };

    class Demo {
        constructor(root) {
            this.root = root;
            this.name = root.dataset.demo;
            this.steps = Number(root.dataset.steps) || 1;
            this.interval = Number(root.dataset.interval) || 1500;
            this.printFrame = root.dataset.print === undefined ? this.steps - 1 : Number(root.dataset.print);
            this.frame = 0;
            this.timer = null;
            this.nodes = [...root.querySelectorAll('[data-from], [data-at], [data-lit]')];
            this.buildControls();
            this.set(0);
        }

        buildControls() {
            const box = this.root.querySelector('[data-controls]');
            if (!box) return;
            box.innerHTML = '<button type="button" data-replay aria-label="처음부터 다시 재생">↺ 다시</button>'
                + '<button type="button" data-back aria-label="이전 단계">‹</button>'
                + '<span data-count></span>'
                + '<button type="button" data-forward aria-label="다음 단계">›</button>';
            const bind = (selector, action) => box.querySelector(selector).addEventListener('click', (event) => {
                action();
                // 마우스로 누른 뒤에도 방향키로 슬라이드를 넘길 수 있게 합니다.
                if (event.detail) event.currentTarget.blur();
            });
            bind('[data-replay]', () => this.play());
            bind('[data-back]', () => { this.stop(); this.set(this.frame - 1); });
            bind('[data-forward]', () => { this.stop(); this.set(this.frame + 1); });
            this.controls = box;
        }

        set(frame) {
            this.frame = Math.max(0, Math.min(frame, this.steps - 1));
            this.root.dataset.frame = String(this.frame);
            for (const node of this.nodes) {
                const { from, at, lit } = node.dataset;
                const visible = (from === undefined || this.frame >= Number(from)) && (at === undefined || inRange(at, this.frame));
                node.classList.toggle('off', !visible);
                if (lit !== undefined) node.classList.toggle('lit', inRange(lit, this.frame));
            }
            if (this.controls) {
                this.controls.querySelector('[data-count]').textContent = `${this.frame + 1} / ${this.steps}`;
                this.controls.querySelector('[data-back]').disabled = this.frame === 0;
                this.controls.querySelector('[data-forward]').disabled = this.frame === this.steps - 1;
            }
        }

        play() {
            this.stop();
            if (printing) return;
            if (reduceMotion) { this.set(this.steps - 1); return; }
            this.set(0);
            this.timer = setInterval(() => {
                if (this.frame >= this.steps - 1) this.stop();
                else this.set(this.frame + 1);
            }, this.interval);
        }

        stop() {
            if (this.timer !== null) clearInterval(this.timer);
            this.timer = null;
        }
    }

    // 대화가 길어질수록 누적 사용량이 제곱으로 느는 모습을 보여 주는 막대그래프
    const chart = (() => {
        const root = document.querySelector('[data-chart="square"]');
        if (!root) return null;
        const max = 20;
        const bars = root.querySelector('[data-bars]');
        const axis = root.querySelector('[data-axis]');
        const input = root.querySelector('[data-turns]');
        const cumulative = (n) => n * (n + 1) / 2;
        bars.innerHTML = Array.from({ length: max }, (_, i) => `<span class="bar" title="${i + 1}번째 질문: 보내는 양 ${i + 1}"><span class="bar-label">${i + 1}</span></span>`).join('');
        axis.innerHTML = Array.from({ length: max }, (_, i) => `<span>${(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>`).join('');
        const barNodes = [...bars.children];

        const set = (n, { grow = false } = {}) => {
            n = Math.max(1, Math.min(max, Math.round(n)));
            input.value = String(n);
            barNodes.forEach((bar, i) => {
                const shown = i < n;
                bar.classList.toggle('empty', !shown);
                bar.classList.toggle('last', i === n - 1);
                bar.style.setProperty('--h', grow || !shown ? '0%' : `${((i + 1) / max) * 100}%`);
            });
            root.querySelector('[data-turns-out]').textContent = `${n}번`;
            root.querySelector('[data-total-label]').textContent = `질문 ${n}번 동안 보낸 양 (누적)`;
            root.querySelector('[data-total]').textContent = cumulative(n).toLocaleString('ko-KR');
            root.querySelector('[data-formula]').textContent = n === 1 ? '1' : n === 2 ? '1 + 2' : `1 + 2 + … + ${n}`;
            root.querySelector('[data-double-label]').textContent = `질문을 두 배인 ${n * 2}번으로 늘리면`;
            root.querySelector('[data-double]').textContent = cumulative(n * 2).toLocaleString('ko-KR');
            root.querySelector('[data-ratio]').textContent = `약 ${(cumulative(n * 2) / cumulative(n)).toFixed(1)}배`;
            root.dataset.turns = String(n);
        };

        let growTimer = null;
        const animate = () => {
            clearTimeout(growTimer);
            if (reduceMotion || printing) { set(Number(input.value)); return; }
            set(Number(input.value), { grow: true });
            growTimer = setTimeout(() => set(Number(input.value)), 60);
        };

        input.addEventListener('input', () => set(Number(input.value)));
        input.addEventListener('pointerup', () => input.blur());
        set(10);
        return { root, set, animate, get turns() { return Number(input.value); } };
    })();

    document.querySelectorAll('[data-demo]').forEach((root) => {
        const demo = new Demo(root);
        demos.set(demo.name, demo);
    });

    window.addEventListener('deck:slidechange', ({ detail }) => {
        demos.forEach((demo) => demo.stop());
        const demo = demos.get(detail.slide.dataset.demo);
        if (demo) demo.play();
        if (chart && detail.slide === chart.root) chart.animate();
    });

    window.addEventListener('deck:prepareprint', () => {
        printing = true;
        demos.forEach((demo) => { demo.stop(); demo.set(demo.printFrame); });
        chart?.set(10);
    });

    window.addEventListener('afterprint', () => { printing = false; });

    window.aiGuideDeck = {
        demos,
        setStep: (name, frame) => { const demo = demos.get(name); demo.stop(); demo.set(frame); },
        setTurns: (n) => chart?.set(n),
        snapshot: () => ({
            printing,
            frames: Object.fromEntries([...demos].map(([name, demo]) => [name, demo.frame])),
            playing: [...demos].filter(([, demo]) => demo.timer !== null).map(([name]) => name),
            turns: chart?.turns,
        }),
    };
})();
