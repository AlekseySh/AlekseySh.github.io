document.addEventListener('DOMContentLoaded', function () {
    var data = window.__siteData;
    if (!data) return;

    document.querySelectorAll('[data-config]').forEach(function (el) {
        var key = el.getAttribute('data-config');

        // Resolve dot-notation path (e.g. "contacts.email" or "examples.1")
        var value = key.split('.').reduce(function (obj, k) {
            return obj && obj[k];
        }, data);

        if (value === undefined || value === null) return;

        // Special handling for email: mailto href + visible text
        if (key === 'contacts.email') {
            el.setAttribute('href', 'mailto:' + value);
            // Update text node (after the icon) with the email address
            var icon = el.querySelector('[data-lucide]');
            if (icon) {
                // Preserve icon, replace text
                el.textContent = '';
                el.appendChild(icon);
                el.appendChild(document.createTextNode(' ' + value));
            } else {
                el.textContent = value;
            }
        } else {
            el.setAttribute('href', value);
        }
    });
});
