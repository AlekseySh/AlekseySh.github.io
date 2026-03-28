(function () {
    'use strict';

    var resizeTimer = null;

    function getCurrentLang() {
        return localStorage.getItem('cutto_lang') || document.documentElement.lang || 'ru';
    }

    function getExamplesForLanguage(lang) {
        var siteData = window.__siteData || {};
        var examplesByLanguage = siteData.examples || {};
        var examples = examplesByLanguage[lang];

        return Array.isArray(examples) ? examples : [];
    }

    function createExampleItem(example, isDuplicate) {
        var item = document.createElement('a');
        var icon = document.createElement('i');
        var label = document.createElement('span');

        item.className = 'marquee-item';
        item.href = example.href;
        item.target = '_blank';
        item.rel = 'noopener';

        if (isDuplicate) {
            item.setAttribute('aria-hidden', 'true');
            item.tabIndex = -1;
        }

        icon.setAttribute('data-lucide', example.icon || 'layout-dashboard');
        label.textContent = example.label || '';

        item.appendChild(icon);
        item.appendChild(label);

        return item;
    }

    function createGroup(examples, isDuplicate) {
        var group = document.createElement('div');
        var i;

        group.className = 'marquee-group';

        if (isDuplicate) {
            group.setAttribute('aria-hidden', 'true');
        }

        for (i = 0; i < examples.length; i += 1) {
            group.appendChild(createExampleItem(examples[i], isDuplicate));
        }

        return group;
    }

    function getTrackGap(track) {
        var styles = window.getComputedStyle(track);
        var gap = parseFloat(styles.columnGap || styles.gap || '0');

        return isNaN(gap) ? 0 : gap;
    }

    function buildLoopExamples(examples, marquee, track) {
        var measureGroup = createGroup(examples, false);
        var cycleWidth;
        var containerWidth;
        var repeatCount;
        var loopExamples = [];
        var i;
        var j;

        marquee.hidden = false;
        track.appendChild(measureGroup);

        cycleWidth = measureGroup.getBoundingClientRect().width;
        containerWidth = marquee.getBoundingClientRect().width;

        track.textContent = '';

        if (!cycleWidth || !containerWidth || window.matchMedia('(max-width: 600px)').matches) {
            return examples.slice();
        }

        repeatCount = Math.max(1, Math.ceil(containerWidth / cycleWidth));

        for (i = 0; i < repeatCount; i += 1) {
            for (j = 0; j < examples.length; j += 1) {
                loopExamples.push(examples[j]);
            }
        }

        return loopExamples;
    }

    function renderMarquee() {
        var marquee = document.querySelector('.examples-marquee');
        var track = marquee && marquee.querySelector('.marquee-track');
        var examples = getExamplesForLanguage(getCurrentLang());
        var loopExamples;
        var primaryGroup;
        var duplicateGroup;
        var loopWidth;

        if (!marquee || !track) return;

        track.textContent = '';
        track.style.removeProperty('--marquee-loop-width');

        if (!examples.length) {
            marquee.hidden = true;
            return;
        }

        loopExamples = buildLoopExamples(examples, marquee, track);
        primaryGroup = createGroup(loopExamples, false);
        duplicateGroup = createGroup(loopExamples, true);

        track.appendChild(primaryGroup);
        track.appendChild(duplicateGroup);
        marquee.hidden = false;
        loopWidth = primaryGroup.getBoundingClientRect().width + getTrackGap(track);
        track.style.setProperty('--marquee-loop-width', loopWidth + 'px');

        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }

    function scheduleRender() {
        if (resizeTimer) {
            window.clearTimeout(resizeTimer);
        }

        resizeTimer = window.setTimeout(renderMarquee, 120);
    }

    function patchI18n() {
        var original = window.i18n && window.i18n.setLanguage;

        if (!original || original.__examplesPatched) return;

        function wrappedSetLanguage(lang) {
            original(lang);
            renderMarquee();
        }

        wrappedSetLanguage.__examplesPatched = true;
        window.i18n.setLanguage = wrappedSetLanguage;
    }

    function init() {
        renderMarquee();
        patchI18n();
        window.addEventListener('resize', scheduleRender);
        window.addEventListener('load', renderMarquee);

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(renderMarquee);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
