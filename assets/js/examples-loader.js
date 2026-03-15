(function () {
    'use strict';

    // Map: language -> array of example overrides (index 0-based)
    // Each entry: { file: 'path', icon: 'lucide-icon-name' } or null for default behavior
    var EXAMPLE_MAP = {
        ru: [
            { file: 'examples/dashboard_alipov_saveliev.html', icon: 'layout-dashboard' },
            { file: 'examples/dashboard_alipov_saveliev.html', icon: 'layout-dashboard' },
            { file: 'examples/dashboard_alipov_saveliev.html', icon: 'layout-dashboard' }
        ]
    };

    function getCurrentLang() {
        return localStorage.getItem('cutto_lang') || document.documentElement.lang || 'ru';
    }

    function updateMarqueeItems() {
        var lang = getCurrentLang();
        var overrides = EXAMPLE_MAP[lang] || [];
        var items = document.querySelectorAll('.marquee-item');

        items.forEach(function (item) {
            var configKey = item.getAttribute('data-config');
            if (!configKey) return;

            // Extract index from "examples.0", "examples.1", etc.
            var idx = parseInt(configKey.split('.')[1], 10);
            if (isNaN(idx)) return;

            var override = overrides[idx] || null;
            var iconEl = item.querySelector('[data-lucide]');

            if (override && override.file) {
                // This item opens in a new tab
                item.setAttribute('target', '_blank');
                item.setAttribute('href', override.file);

                if (iconEl && override.icon) {
                    iconEl.setAttribute('data-lucide', override.icon);
                }
            } else {
                // Default: plain link to index.html
                item.setAttribute('target', '_blank');
                item.removeAttribute('data-example-file');

                if (iconEl) {
                    iconEl.setAttribute('data-lucide', 'youtube');
                }
            }
        });

        // Re-init Lucide icons to render changed icon names
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    // Wrap i18n.setLanguage to update marquee after language change
    function patchI18n() {
        var original = window.i18n && window.i18n.setLanguage;
        if (!original) return;

        window.i18n.setLanguage = function (lang) {
            original(lang);
            updateMarqueeItems();
        };
    }

    function init() {
        updateMarqueeItems();
        patchI18n();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
