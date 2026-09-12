(() => {
    'use strict';

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    class Deck {
        constructor(root) {
            this.root = root;
            this.slides = [...root.querySelectorAll('.slide')];
            this.current = 0;
            this.pointerStart = null;
            this.isPrint = new URLSearchParams(location.search).has('print');
            this.controls = {
                previous: document.querySelector('[data-deck-previous]'),
                next: document.querySelector('[data-deck-next]'),
                count: document.querySelector('[data-deck-count]'),
                progress: document.querySelector('[data-deck-progress]'),
                notes: document.querySelector('[data-deck-notes]'),
            };

            if (!this.slides.length) return;
            this.decorateSlides();
            this.bind();

            if (this.isPrint) {
                this.preparePrint();
                return;
            }

            this.go(this.indexFromHash(), { updateHash: false });
        }

        decorateSlides() {
            const footerText = this.root.dataset.deckFooter || this.root.dataset.deckTitle || '';
            this.slides.forEach((slide, index) => {
                if (!slide.querySelector('.slide-footer')) {
                    const footer = document.createElement('div');
                    footer.className = 'slide-footer';
                    footer.textContent = footerText;
                    slide.append(footer);
                }
                if (!slide.querySelector('.slide-number')) {
                    const number = document.createElement('div');
                    number.className = 'slide-number';
                    number.textContent = String(index + 1).padStart(2, '0');
                    slide.append(number);
                }
            });
        }

        bind() {
            window.addEventListener('beforeprint', () => this.preparePrint());
            window.addEventListener('afterprint', () => {
                if (this.isPrint) return;
                document.documentElement.classList.remove('print-view');
                this.root.querySelectorAll('.print-page').forEach((page) => page.replaceWith(...page.childNodes));
                this.go(this.current, { updateHash: false });
            });
            this.controls.previous?.addEventListener('click', () => this.previous());
            this.controls.next?.addEventListener('click', () => this.next());

            window.addEventListener('hashchange', () => this.go(this.indexFromHash(), { updateHash: false }));
            document.addEventListener('keydown', (event) => this.onKeyDown(event));

            this.root.addEventListener('pointerdown', (event) => {
                if (event.pointerType === 'mouse') return;
                this.pointerStart = { x: event.clientX, y: event.clientY };
            }, { passive: true });

            this.root.addEventListener('pointerup', (event) => {
                if (!this.pointerStart || event.pointerType === 'mouse') return;
                const dx = event.clientX - this.pointerStart.x;
                const dy = event.clientY - this.pointerStart.y;
                this.pointerStart = null;
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                    dx < 0 ? this.next() : this.previous();
                }
            }, { passive: true });
        }

        indexFromHash() {
            const match = location.hash.match(/(?:#\/?)(\d+)/);
            return match ? clamp(Number(match[1]) - 1, 0, this.slides.length - 1) : 0;
        }

        preparePrint() {
            document.documentElement.classList.add('print-view');
            this.slides.forEach((slide) => {
                if (!slide.parentElement.classList.contains('print-page')) {
                    const page = document.createElement('div');
                    page.className = 'print-page';
                    slide.before(page);
                    page.append(slide);
                }
                slide.classList.add('is-active');
                slide.setAttribute('aria-hidden', 'false');
                if ('inert' in slide) slide.inert = false;
            });
            window.dispatchEvent(new CustomEvent('deck:prepareprint'));
        }

        onKeyDown(event) {
            if (this.isPrint) return;
            const target = event.target;
            const isEditing = target instanceof HTMLElement
                && (target.matches('input, textarea, select, button, a, [contenteditable="true"]'));

            if (!isEditing && ['ArrowRight', 'PageDown', ' '].includes(event.key)) {
                event.preventDefault();
                this.next();
            } else if (!isEditing && ['ArrowLeft', 'PageUp'].includes(event.key)) {
                event.preventDefault();
                this.previous();
            } else if (!isEditing && event.key === 'Home') {
                event.preventDefault();
                this.go(0);
            } else if (!isEditing && event.key === 'End') {
                event.preventDefault();
                this.go(this.slides.length - 1);
            } else if (!isEditing && event.key.toLowerCase() === 'f') {
                event.preventDefault();
                this.toggleFullscreen();
            } else if (!isEditing && event.key.toLowerCase() === 'n') {
                event.preventDefault();
                this.toggleNotes();
            }
        }

        go(index, { updateHash = true } = {}) {
            if (this.isPrint) return;
            index = clamp(index, 0, this.slides.length - 1);
            const previousSlide = this.slides[this.current];
            const nextSlide = this.slides[index];

            if (previousSlide && previousSlide !== nextSlide && previousSlide.contains(document.activeElement)) {
                document.activeElement.blur();
            }

            this.slides.forEach((slide, slideIndex) => {
                const active = slideIndex === index;
                slide.classList.toggle('is-active', active);
                slide.setAttribute('aria-hidden', String(!active));
                if ('inert' in slide) slide.inert = !active;
            });

            this.current = index;
            this.controls.previous?.toggleAttribute('disabled', index === 0);
            this.controls.next?.toggleAttribute('disabled', index === this.slides.length - 1);
            if (this.controls.count) this.controls.count.textContent = `${index + 1} / ${this.slides.length}`;
            if (this.controls.progress) this.controls.progress.style.width = `${((index + 1) / this.slides.length) * 100}%`;
            document.title = `${nextSlide.dataset.title || nextSlide.querySelector('h1, h2')?.textContent || ''} · ${this.root.dataset.deckTitle || 'ppt.205.kr'}`;

            if (updateHash) history.replaceState(null, '', `#/${index + 1}`);
            this.updateNotes(nextSlide);

            window.dispatchEvent(new CustomEvent('deck:slidechange', {
                detail: { index, slide: nextSlide, previousSlide },
            }));
        }

        next() {
            this.go(this.current + 1);
        }

        previous() {
            this.go(this.current - 1);
        }

        updateNotes(slide) {
            if (!this.controls.notes) return;
            const note = slide.querySelector('.speaker-notes');
            this.controls.notes.innerHTML = note?.innerHTML || '<p>이 슬라이드에는 발표자 노트가 없습니다.</p>';
        }

        toggleNotes() {
            document.body.classList.toggle('show-notes');
        }

        async toggleFullscreen() {
            try {
                if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
                else await document.exitFullscreen();
            } catch (error) {
                console.warn('전체 화면을 열 수 없습니다.', error);
            }
        }
    }

    window.PPT205 = { Deck };
    window.addEventListener('DOMContentLoaded', () => {
        const root = document.querySelector('[data-deck]');
        if (root) window.ppt205Deck = new Deck(root);
    });
})();
