(() => {
    'use strict';
    const updateScene = (slide) => {
        document.querySelectorAll('[data-scene-target]').forEach((button) => {
            if (button.dataset.sceneTarget === slide?.dataset.scene) button.setAttribute('aria-current', 'true');
            else button.removeAttribute('aria-current');
        });
    };
    window.addEventListener('deck:slidechange', ({ detail }) => updateScene(detail.slide));
    window.addEventListener('DOMContentLoaded', () => {
        const deck = window.ppt205Deck;
        if (!deck) return;
        updateScene(deck.slides[deck.current]);
        document.querySelectorAll('[data-scene-target]').forEach((button) => {
            button.addEventListener('click', () => {
                const index = deck.slides.findIndex((slide) => slide.dataset.scene === button.dataset.sceneTarget);
                if (index >= 0) deck.go(index);
            });
        });
        document.querySelector('[data-reader-fullscreen]').addEventListener('click', () => deck.toggleFullscreen());
        // Pointer clicks return focus to the document so arrow keys keep advancing the script.
        document.querySelectorAll('button').forEach((button) => {
            button.addEventListener('click', (event) => { if (event.detail > 0) button.blur(); });
        });
    });
})();
