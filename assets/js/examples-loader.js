(function () {
    'use strict';

    function getCurrentLang() {
        return localStorage.getItem('cutto_lang') || document.documentElement.lang || 'ru';
    }

    function getExamplesForLanguage(lang) {
        var catalog = window.exampleCatalog;

        if (!catalog || typeof catalog.getExamplesForLanguage !== 'function') {
            return [];
        }

        return catalog.getExamplesForLanguage(lang);
    }

    function getTranslations(lang) {
        return (window.__translations || {})[lang] || {};
    }

    function getTranslatedCopy(lang) {
        var translations = getTranslations(lang);

        return {
            openPlaylist: translations['examples.openPlaylist'] || 'open playlist',
            openProject: translations['examples.openProject'] || 'open project'
        };
    }

    function createActionLink(copy, iconName, className, href) {
        var action = document.createElement('a');
        var icon = document.createElement('i');
        var label = document.createElement('span');

        action.className = 'example-card-button ' + className;
        action.href = href;
        action.target = '_blank';
        action.rel = 'noopener';

        icon.setAttribute('data-lucide', iconName);
        label.className = 'example-card-button-label';
        label.textContent = copy;

        action.appendChild(icon);
        action.appendChild(label);

        return action;
    }

    function createExampleItem(example, copy) {
        var item = document.createElement('article');
        var title = document.createElement('h3');
        var actions = document.createElement('div');

        item.className = 'example-card';

        title.className = 'example-card-title';
        title.textContent = example.title || '';

        actions.className = 'example-card-actions';

        if (example.playlistHref) {
            actions.appendChild(createActionLink(copy.openPlaylist, 'youtube', 'example-card-button--youtube', example.playlistHref));
        }

        if (example.dashboardPath) {
            actions.appendChild(createActionLink(copy.openProject, 'file-text', 'example-card-button--project', example.dashboardPath));
        }

        item.appendChild(title);
        item.appendChild(actions);

        return item;
    }

    function renderExamples() {
        var showcase = document.querySelector('.examples-showcase');
        var grid = showcase && showcase.querySelector('.examples-grid');
        var lang = getCurrentLang();
        var examples = getExamplesForLanguage(lang);
        var copy = getTranslatedCopy(lang);
        var i;

        if (!showcase || !grid) return;
        grid.textContent = '';

        if (!examples.length) {
            showcase.hidden = true;
            return;
        }

        for (i = 0; i < examples.length; i += 1) {
            grid.appendChild(createExampleItem(examples[i], copy));
        }

        showcase.hidden = false;

        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    function patchI18n() {
        var original = window.i18n && window.i18n.setLanguage;

        if (!original || original.__examplesPatched) return;

        function wrappedSetLanguage(lang) {
            original(lang);
            renderExamples();
        }

        wrappedSetLanguage.__examplesPatched = true;
        window.i18n.setLanguage = wrappedSetLanguage;
    }

    function init() {
        renderExamples();
        patchI18n();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
