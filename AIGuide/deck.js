(() => {
    'use strict';
    // data-from="n": n단계부터 보임 · data-at="a-b": a~b단계에만 보임 · data-lit="a-b": 해당 단계에 강조
    // data-times="ms,ms,…": 단계마다 머무는 시간 (없으면 data-interval)
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const demos = new Map();
    let printing = false;
    // 수동 모드(A 키): 자동 재생 없이 → ← 키가 움직이는 장면의 단계를 먼저 넘깁니다. 내레이션 녹화용.
    let manual = false;

    const inRange = (spec, frame) => {
        const [start, end = start] = spec.split('-').map(Number);
        return frame >= start && frame <= end;
    };

    // 같은 클래스를 다시 붙여도 CSS 애니메이션이 처음부터 재생되게 합니다.
    const restart = (element, className) => {
        element.classList.remove(className);
        void element.offsetWidth;
        element.classList.add(className);
    };

    // 질문할 때마다 대화 전체를 보내고, 보낸 카드가 정사각형으로 쌓이는 장면
    const stack = (() => {
        const questions = [1, 2, 3, 4, 8, 8];
        return (root, frame, live) => {
            const grid = root.querySelector('[data-grid]');
            if (!grid.children.length) {
                for (let row = 0; row < 8; row += 1) {
                    for (let col = 0; col < 8; col += 1) {
                        const turn = Math.max(row, col) + 1;
                        const cell = document.createElement('span');
                        cell.className = 'st-cell';
                        Object.assign(cell.dataset, { row, col, turn });
                        cell.append(document.createElement('i'));
                        grid.append(cell);
                    }
                }
            }
            const n = questions[frame];
            const size = n > 4 ? 8 : 4;
            const sent = frame >= 4 ? 2 * 8 - 1 : 2 * n - 1;
            let order = 0;
            for (const cell of grid.children) {
                const { row, col, turn } = cell.dataset;
                cell.style.left = `${(col * 100) / size}%`;
                cell.style.top = `${(row * 100) / size}%`;
                cell.style.width = cell.style.height = `${100 / size}%`;
                const on = Number(turn) <= n;
                const appearing = on && !cell.classList.contains('on');
                cell.classList.toggle('on', on);
                cell.classList.toggle('now', Number(turn) === n);
                const fresh = live && on && frame <= 4 && (frame === 4 ? Number(turn) > 4 : Number(turn) === n);
                cell.classList.remove('fresh');
                if (fresh) {
                    cell.style.setProperty('--d', `${(frame === 4 ? 1.1 : 1.25) + order * (frame === 4 ? 0.018 : 0.07)}s`);
                    order += 1;
                    restart(cell, 'fresh');
                } else if (appearing) {
                    // 튀어나오는 효과 없이 나타나는 칸은 이동 과정 없이 바로 제자리에 둡니다.
                    cell.classList.add('instant');
                }
            }
            void grid.offsetWidth;
            requestAnimationFrame(() => grid.querySelectorAll('.instant').forEach((cell) => cell.classList.remove('instant')));
            const now = root.querySelector('[data-now]');
            const total = root.querySelector('[data-total]');
            now.textContent = String(sent);
            total.textContent = String(n * n);

            const bundle = root.querySelector('[data-bundle]');
            bundle.innerHTML = Array.from({ length: sent }, (_, j) => `<i style="--j:${Math.min(j, 14)}"></i>`).join('') + `<b>카드 ${sent}장</b>`;
            bundle.classList.remove('fly');
            root.querySelector('[data-ai]').classList.remove('reading');
            root.querySelectorAll('.st-cards > span').forEach((card) => card.classList.remove('copy'));
            if (!live || frame > 4) return;
            restart(bundle, 'fly');
            restart(root.querySelector('[data-ai]'), 'reading');
            root.querySelectorAll('.st-cards > span:not(.off):not(.card-more)').forEach((card) => restart(card, 'copy'));
            restart(now, 'bump');
            restart(total, 'bump');
        };
    })();

    // 계산한 카드를 저장해 두었다가 시간이 지나면 지워지는 장면
    const cache = (() => {
        // 단계별 카드 상태: calc 새로 계산 · saved 저장됨 · expired 저장이 지워짐 · plain 대기
        const states = [
            ['calc', 'calc', 'calc', 'calc'],
            ['saved', 'saved', 'saved', 'saved'],
            ['saved', 'saved', 'saved', 'saved', 'calc'],
            ['expired', 'expired', 'expired', 'expired', 'expired', 'plain'],
            ['calc', 'calc', 'calc', 'calc', 'calc', 'calc', 'calc'],
        ];
        // 막대별 새로 계산한 카드 수와 재사용한 양 (8칸이 막대 전체 높이)
        const bars = [[4, 0], [1, 0.6], [7, 0]];
        const shownFrom = [0, 2, 4];
        return (root, frame, live) => {
            const cards = [...root.querySelectorAll('[data-cache-cards] .ca-card')];
            cards.forEach((card, i) => {
                const state = states[frame][i] || 'hidden';
                card.className = `ca-card ${card.classList.contains('q') ? 'q' : 'a'} ${state}`;
                card.style.setProperty('--d', `${0.15 + i * 0.18}s`);
                if (live && state !== 'hidden' && state !== 'plain') restart(card, 'go');
            });
            root.querySelectorAll('[data-cache-bars] .ca-bar').forEach((bar, i) => {
                const [fresh, reused] = frame >= shownFrom[i] ? bars[i] : [0, 0];
                bar.querySelector('.new').style.setProperty('--u', fresh);
                bar.querySelector('.reuse')?.style.setProperty('--u', reused);
                bar.dataset.units = String(fresh + reused);
            });
        };
    })();

    const scenes = { stack, cache };

    class Demo {
        constructor(root) {
            this.root = root;
            this.name = root.dataset.demo;
            this.steps = Number(root.dataset.steps) || 1;
            this.interval = Number(root.dataset.interval) || 1500;
            this.times = (root.dataset.times || '').split(',').filter(Boolean).map(Number);
            this.printFrame = root.dataset.print === undefined ? this.steps - 1 : Number(root.dataset.print);
            this.frame = 0;
            this.timer = null;
            this.nodes = [...root.querySelectorAll('[data-from], [data-at], [data-lit]')];
            this.buildControls();
            this.set(0, { live: false });
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

        set(frame, { live = !printing } = {}) {
            this.frame = Math.max(0, Math.min(frame, this.steps - 1));
            this.root.dataset.frame = String(this.frame);
            for (const node of this.nodes) {
                const { from, at, lit } = node.dataset;
                const visible = (from === undefined || this.frame >= Number(from)) && (at === undefined || inRange(at, this.frame));
                node.classList.toggle('off', !visible);
                if (lit !== undefined) node.classList.toggle('lit', inRange(lit, this.frame));
            }
            scenes[this.name]?.(this.root, this.frame, live && !reduceMotion);
            if (this.controls) {
                this.controls.querySelector('[data-count]').textContent = `${this.frame + 1} / ${this.steps}`;
                this.controls.querySelector('[data-back]').disabled = this.frame === 0;
                this.controls.querySelector('[data-forward]').disabled = this.frame === this.steps - 1;
            }
        }

        play() {
            this.stop();
            if (printing) return;
            if (manual) { this.set(0); return; }
            if (reduceMotion) { this.set(this.steps - 1); return; }
            this.set(0);
            this.schedule();
        }

        schedule() {
            if (this.frame >= this.steps - 1) { this.timer = null; return; }
            this.timer = setTimeout(() => {
                this.set(this.frame + 1);
                this.schedule();
            }, this.times[this.frame] || this.interval);
        }

        stop() {
            if (this.timer !== null) clearTimeout(this.timer);
            this.timer = null;
        }
    }

    document.querySelectorAll('[data-demo]').forEach((root) => {
        const demo = new Demo(root);
        demos.set(demo.name, demo);
    });

    const currentDemo = () => {
        const deck = window.ppt205Deck;
        return deck ? demos.get(deck.slides[deck.current]?.dataset.demo) : undefined;
    };

    const toast = document.createElement('p');
    toast.className = 'mode-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
    let toastTimer = null;
    const notify = (text) => {
        toast.textContent = text;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
    };

    const setManual = (value) => {
        manual = value;
        demos.forEach((demo) => demo.stop());
        currentDemo()?.play();
        notify(manual ? '자동 재생 끔 · → 키로 한 단계씩' : '자동 재생 켬');
    };

    // G: 영상 촬영용 자막 영역(하단 30%) 표시 · A: 수동 모드
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
        const key = event.key.toLowerCase();
        if (key === 'g') document.body.classList.toggle('subtitle-guide');
        if (key === 'a' && !printing) setManual(!manual);
    });

    // 수동 모드에서는 공통 키 처리보다 먼저 받아 장면 단계를 넘기고, 첫·마지막 단계에서만 슬라이드를 넘깁니다.
    window.addEventListener('keydown', (event) => {
        if (!manual || printing || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, button, a, [contenteditable="true"]')) return;
        const forward = ['ArrowRight', 'PageDown', ' '].includes(event.key);
        if (!forward && !['ArrowLeft', 'PageUp'].includes(event.key)) return;
        const demo = currentDemo();
        const target = demo ? demo.frame + (forward ? 1 : -1) : -1;
        if (!demo || target < 0 || target >= demo.steps) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        demo.set(target);
    }, true);

    window.addEventListener('deck:slidechange', ({ detail }) => {
        demos.forEach((demo) => demo.stop());
        const demo = demos.get(detail.slide.dataset.demo);
        const slides = window.ppt205Deck?.slides || [];
        // 수동 모드에서 뒤로 돌아온 장면은 마지막 단계부터 보여 줍니다.
        if (demo && manual && slides.indexOf(detail.previousSlide) > detail.index) demo.set(demo.steps - 1);
        else demo?.play();
    });

    window.addEventListener('deck:prepareprint', () => {
        printing = true;
        demos.forEach((demo) => { demo.stop(); demo.set(demo.printFrame, { live: false }); });
    });

    window.addEventListener('afterprint', () => { printing = false; });

    window.aiGuideDeck = {
        demos,
        setStep: (name, frame) => { const demo = demos.get(name); demo.stop(); demo.set(frame, { live: false }); },
        snapshot: () => ({
            printing,
            manual,
            frames: Object.fromEntries([...demos].map(([name, demo]) => [name, demo.frame])),
            playing: [...demos].filter(([, demo]) => demo.timer !== null).map(([name]) => name),
        }),
    };
})();
