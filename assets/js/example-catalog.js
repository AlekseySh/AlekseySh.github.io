(function () {
    'use strict';

    function getSiteData() {
        return window.__siteData || {};
    }

    function getExamplesConfig() {
        return getSiteData().examples || {};
    }

    function getExampleItems() {
        var items = getExamplesConfig().items;

        return items && typeof items === 'object' ? items : {};
    }

    function getExampleOrder() {
        var order = getExamplesConfig().order;

        return Array.isArray(order) ? order.slice() : [];
    }

    function getExampleById(exampleId) {
        if (!exampleId) return null;

        return getExampleItems()[exampleId] || null;
    }

    function getExampleTitle(example) {
        return example && typeof example.title === 'string' ? example.title : '';
    }

    function getExamplesForLanguage() {
        var items = getExampleItems();
        var order = getExampleOrder();
        var examples = [];
        var i;
        var exampleId;
        var example;
        var title;

        for (i = 0; i < order.length; i += 1) {
            exampleId = order[i];
            example = items[exampleId];

            if (!example) continue;
            if (example.showOnHome === false) continue;

            title = getExampleTitle(example);

            if (!title) continue;

            examples.push({
                id: exampleId,
                dashboardPath: example.dashboardPath || '',
                playlistHref: example.playlistHref || '',
                lang: example.lang || '',
                title: title
            });
        }

        return examples;
    }

    function syncCurrentExamplePage(root) {
        var scope = root || document;
        var body = document.body;
        var exampleId = body && body.getAttribute('data-example-id');
        var example = getExampleById(exampleId);
        var playlistLink = scope.querySelector('[data-example-playlist-link]');

        if (!playlistLink) {
            return example;
        }

        if (!example || !example.playlistHref) {
            playlistLink.hidden = true;
            return example;
        }

        playlistLink.href = example.playlistHref;
        playlistLink.hidden = false;

        return example;
    }

    window.exampleCatalog = {
        getExampleById: getExampleById,
        getExamplesForLanguage: getExamplesForLanguage,
        getExampleTitle: getExampleTitle,
        syncCurrentExamplePage: syncCurrentExamplePage
    };
})();
