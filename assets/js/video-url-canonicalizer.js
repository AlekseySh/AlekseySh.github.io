(function (root) {
    'use strict';

    var VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
    var VOD_ID_RE = /^\d+$/;
    var YOUTUBE_CANONICAL_BASE = 'https://www.youtube.com/watch?v=';
    var TWITCH_CANONICAL_BASE = 'https://www.twitch.tv/videos/';

    var ERROR_KEYS = {
        youtube: 'application.error.youtubeUrl',
        twitch: 'application.error.twitchUrl',
        unsupported: 'application.error.unsupportedVideoUrl'
    };

    var FALLBACK_MESSAGES = {
        youtube: 'Please paste a YouTube link to a specific video. Playlists, channels, clips, and search pages are not supported.',
        twitch: 'Please paste a Twitch link to a specific VOD. Live channels, clips, collections, and video lists are not supported.',
        unsupported: 'Please paste a supported YouTube or Twitch video link.'
    };

    var YOUTUBE_QUERY_HOSTS = ['www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
    var YOUTUBE_PATH_PREFIXES = ['live', 'shorts', 'embed', 'v', 'e'];
    var TWITCH_VIDEO_HOSTS = ['www.twitch.tv', 'm.twitch.tv', 'go.twitch.tv'];

    function getActiveLanguage() {
        if (typeof document === 'undefined' || !document.documentElement) return 'en';
        return document.documentElement.lang || 'en';
    }

    function getMessage(platform) {
        var key = ERROR_KEYS[platform];
        var lang = getActiveLanguage();
        var translations = (root.__translations && root.__translations[lang]) || {};
        return translations[key] || FALLBACK_MESSAGES[platform];
    }

    function errorResult(platform) {
        var result = {
            ok: false,
            error: getMessage(platform)
        };

        if (platform === 'youtube' || platform === 'twitch') {
            result.platform = platform;
        }

        return result;
    }

    function okResult(platform, canonicalUrl) {
        return {
            ok: true,
            canonicalUrl: canonicalUrl,
            platform: platform
        };
    }

    function getPathSegments(url) {
        return url.pathname.split('/').filter(Boolean);
    }

    function hasOneOf(values, value) {
        return values.indexOf(value) !== -1;
    }

    function isYouTubeLikeHost(host) {
        return host === 'youtu.be'
            || host === 'youtube.com'
            || host.slice(-12) === '.youtube.com'
            || host === 'youtube-nocookie.com'
            || host.slice(-21) === '.youtube-nocookie.com';
    }

    function isTwitchLikeHost(host) {
        return host === 'twitch.tv'
            || host.slice(-10) === '.twitch.tv';
    }

    function getSingleYouTubeQueryId(params) {
        var values = params.getAll('v');
        if (values.length === 0) return null;
        if (!VIDEO_ID_RE.test(values[0])) return false;

        for (var i = 1; i < values.length; i++) {
            if (values[i] !== values[0]) return false;
        }

        return values[0];
    }

    function youtubeQueryMatchesPathId(params, id) {
        var values = params.getAll('v');
        for (var i = 0; i < values.length; i++) {
            if (values[i] !== id) return false;
        }
        return true;
    }

    function canonicalizeYouTube(url) {
        var host = url.hostname.toLowerCase();
        var segments = getPathSegments(url);
        var id = null;

        if (url.protocol !== 'https:') return errorResult('youtube');

        if (host === 'youtu.be') {
            if (segments.length !== 1) return errorResult('youtube');
            id = segments[0];
        } else if (hasOneOf(YOUTUBE_QUERY_HOSTS, host)) {
            if (segments.length === 1 && (segments[0] === 'watch' || segments[0] === 'watch_popup')) {
                id = getSingleYouTubeQueryId(url.searchParams);
                if (!id) return errorResult('youtube');
            } else if (
                segments.length === 2
                && hasOneOf(YOUTUBE_PATH_PREFIXES, segments[0])
                && youtubeQueryMatchesPathId(url.searchParams, segments[1])
            ) {
                id = segments[1];
            } else {
                return errorResult('youtube');
            }
        } else if (host === 'www.youtube-nocookie.com') {
            if (
                segments.length === 2
                && segments[0] === 'embed'
                && youtubeQueryMatchesPathId(url.searchParams, segments[1])
            ) {
                id = segments[1];
            } else {
                return errorResult('youtube');
            }
        } else {
            return errorResult('youtube');
        }

        if (!VIDEO_ID_RE.test(id)) return errorResult('youtube');
        return okResult('youtube', YOUTUBE_CANONICAL_BASE + id);
    }

    function normalizeTwitchVodValue(value) {
        if (VOD_ID_RE.test(value)) return value;
        if (/^v\d+$/.test(value)) return value.slice(1);
        return null;
    }

    function getSingleTwitchQueryId(params, name) {
        var values = params.getAll(name);
        if (values.length === 0) return null;

        var id = normalizeTwitchVodValue(values[0]);
        if (!id) return false;

        for (var i = 1; i < values.length; i++) {
            if (normalizeTwitchVodValue(values[i]) !== id) return false;
        }

        return id;
    }

    function twitchQueryMatchesPathId(params, id) {
        var names = ['video', 'vodID'];

        for (var i = 0; i < names.length; i++) {
            var values = params.getAll(names[i]);
            for (var j = 0; j < values.length; j++) {
                if (normalizeTwitchVodValue(values[j]) !== id) return false;
            }
        }

        return true;
    }

    function canonicalizeTwitch(url) {
        var host = url.hostname.toLowerCase();
        var segments = getPathSegments(url);
        var id = null;

        if (url.protocol !== 'https:') return errorResult('twitch');

        if (host === 'player.twitch.tv') {
            if (segments.length !== 0) return errorResult('twitch');
            id = getSingleTwitchQueryId(url.searchParams, 'video');
            if (!id) return errorResult('twitch');
        } else if (hasOneOf(TWITCH_VIDEO_HOSTS, host) && segments.length === 2 && segments[0] === 'videos') {
            id = segments[1];
            if (!twitchQueryMatchesPathId(url.searchParams, id)) return errorResult('twitch');
        } else if (host === 'www.twitch.tv' && segments.length === 3 && (segments[1] === 'v' || segments[1] === 'video')) {
            id = segments[2];
            if (!twitchQueryMatchesPathId(url.searchParams, id)) return errorResult('twitch');
        } else if (host === 'www.twitch.tv' && segments.length === 2 && segments[1] === 'schedule') {
            id = getSingleTwitchQueryId(url.searchParams, 'vodID');
            if (!id) return errorResult('twitch');
        } else {
            return errorResult('twitch');
        }

        if (!VOD_ID_RE.test(id)) return errorResult('twitch');
        return okResult('twitch', TWITCH_CANONICAL_BASE + id);
    }

    function canonicalizeVideoUrl(rawUrl) {
        var text = String(rawUrl || '').trim();
        var url;

        try {
            url = new URL(text);
        } catch (error) {
            return errorResult('unsupported');
        }

        var host = url.hostname.toLowerCase();
        if (isYouTubeLikeHost(host)) return canonicalizeYouTube(url);
        if (isTwitchLikeHost(host)) return canonicalizeTwitch(url);
        return errorResult('unsupported');
    }

    root.cuttoVideoUrls = {
        canonicalizeVideoUrl: canonicalizeVideoUrl
    };
})(window);
