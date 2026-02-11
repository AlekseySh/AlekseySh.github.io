(function () {
    'use strict';

    var STORAGE_KEY = 'cutto_lang';
    var DEFAULT_LANG = 'ru';
    var SUPPORTED = ['en', 'ru', 'es'];

    function detectLanguage() {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;

        var nav = (navigator.language || '').slice(0, 2).toLowerCase();
        if (SUPPORTED.indexOf(nav) !== -1) return nav;

        return DEFAULT_LANG;
    }

    function apply(lang) {
        var translations = (window.__translations || {})[lang];
        if (!translations) return;

        // Update all [data-i18n] elements
        var elements = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < elements.length; i++) {
            var key = elements[i].getAttribute('data-i18n');
            if (translations[key] !== undefined) {
                elements[i].textContent = translations[key];
            }
        }

        // Update page title
        if (translations['page.title']) {
            document.title = translations['page.title'];
        }
        // Config page title override
        if (translations['config.title'] && document.querySelector('.config-page')) {
            document.title = translations['config.title'];
        }

        // Update <html lang>
        document.documentElement.lang = lang;

        // Toggle active class on switcher buttons
        var buttons = document.querySelectorAll('[data-lang]');
        for (var j = 0; j < buttons.length; j++) {
            if (buttons[j].getAttribute('data-lang') === lang) {
                buttons[j].classList.add('active');
            } else {
                buttons[j].classList.remove('active');
            }
        }

        // Re-init Lucide icons (they might get lost during textContent changes)
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    function setLanguage(lang) {
        if (SUPPORTED.indexOf(lang) === -1) return;
        localStorage.setItem(STORAGE_KEY, lang);
        apply(lang);
    }

    function init() {
        var lang = detectLanguage();
        apply(lang);
    }

    // Expose API
    window.i18n = {
        setLanguage: setLanguage
    };

    // Run on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
