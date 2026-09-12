(() => {
    const list = document.querySelector('[data-deck-list]');
    if (!list) return;

    fetch('decks.json')
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((decks) => {
            list.replaceChildren(...decks.map((deck, index) => {
                const link = document.createElement('a');
                link.className = 'deck-link';
                link.href = `${deck.slug}/`;

                const number = document.createElement('span');
                number.className = 'deck-index';
                number.textContent = String(index + 1).padStart(2, '0');

                const copy = document.createElement('span');
                const title = document.createElement('h2');
                title.textContent = deck.title;
                const meta = document.createElement('p');
                meta.textContent = deck.meta;
                copy.append(title, meta);

                const arrow = document.createElement('span');
                arrow.className = 'arrow';
                arrow.setAttribute('aria-hidden', 'true');
                arrow.textContent = '→';
                link.append(number, copy, arrow);
                return link;
            }));
        })
        .catch((error) => console.warn('decks.json을 읽지 못해 기본 목록을 표시합니다.', error));
})();
