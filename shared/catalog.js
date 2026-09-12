(() => {
    'use strict';

    const list = document.querySelector('[data-deck-list]');
    if (!list) return;
    const search = document.querySelector('[data-deck-search]');
    const filters = document.querySelector('[data-deck-filters]');
    let selectedCategory = '전체';

    function createMaterial(deck) {
        const article = document.createElement('article');
        article.className = 'material';
        const meta = document.createElement('div');
        meta.className = 'material-meta';
        const category = document.createElement('span');
        category.className = 'category';
        category.textContent = deck.category || '발표';
        meta.append(category);
        if (deck.date) {
            const date = document.createElement('time');
            date.dateTime = deck.date;
            date.textContent = deck.date.replaceAll('-', '.');
            meta.append(date);
        }

        const copy = document.createElement('div');
        copy.className = 'material-copy';
        const title = document.createElement('h3');
        const titleLink = document.createElement('a');
        titleLink.href = deck.slug + '/';
        titleLink.textContent = deck.title;
        title.append(titleLink);
        const description = document.createElement('p');
        description.textContent = deck.description || '';
        const detail = document.createElement('span');
        detail.className = 'material-detail';
        detail.textContent = deck.meta || '';
        copy.append(title, description, detail);

        const actions = document.createElement('div');
        actions.className = 'material-actions';
        for (const [label, href, className, arrow, download] of [
            ['웹으로 보기', deck.slug + '/', 'open-link', '↗', false],
            ['PDF 다운로드', deck.slug + '/downloads/' + deck.slug + '.pdf', 'pdf-link', '↓', true],
        ]) {
            const link = document.createElement('a');
            link.className = className;
            link.href = href;
            link.setAttribute('aria-label', deck.title + ' ' + label);
            if (download) link.download = deck.slug + '.pdf';
            const icon = document.createElement('span');
            icon.textContent = arrow;
            icon.setAttribute('aria-hidden', 'true');
            link.append(label, icon);
            actions.append(link);
        }
        article.append(meta, copy, actions);
        return article;
    }

    fetch('decks.json')
        .then((response) => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then((decks) => {
            if (!Array.isArray(decks) || decks.some((deck) => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(deck.slug) || !deck.title)) {
                throw new Error('자료 목록 형식이 올바르지 않습니다.');
            }
            decks = decks.filter((deck) => (deck.status || 'published') === 'published');
            const render = () => {
                const query = search.value.trim().toLocaleLowerCase('ko');
                const visible = decks.filter((deck) => (selectedCategory === '전체' || (deck.category || '발표') === selectedCategory)
                    && [deck.title, deck.description, deck.meta, deck.category].join(' ').toLocaleLowerCase('ko').includes(query));
                list.replaceChildren(...visible.map(createMaterial));
                document.querySelector('[data-deck-count]').textContent = String(visible.length);
                document.querySelector('[data-empty-state]').hidden = visible.length > 0;
                document.querySelector('[data-search-status]').textContent = '자료 ' + visible.length + '개';
            };
            search.addEventListener('input', render);
            document.querySelector('[data-search-field]').hidden = false;
            const categories = [...new Set(decks.map((deck) => deck.category || '발표'))];
            if (categories.length > 1) {
                filters.hidden = false;
                for (const name of ['전체', ...categories]) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = name;
                    button.setAttribute('aria-pressed', String(name === selectedCategory));
                    button.addEventListener('click', () => {
                        selectedCategory = name;
                        filters.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
                        render();
                    });
                    filters.append(button);
                }
            }
            render();
        })
        .catch((error) => console.warn('기본 자료 목록을 표시합니다.', error));
})();
