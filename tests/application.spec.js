const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');
const applicationUrl = pathToFileURL(path.join(repoRoot, 'application', 'index.html')).href;

function readTimecodesEndpoint() {
  const siteDataPath = path.join(repoRoot, 'assets', 'site-data.js');
  const context = { window: {} };

  vm.runInNewContext(fs.readFileSync(siteDataPath, 'utf8'), context, {
    filename: siteDataPath
  });

  return context.window.__siteData.requests.timecodesEndpoint;
}

function readTranslations(lang) {
  const langPath = path.join(repoRoot, 'assets', 'lang', `${lang}.js`);
  const context = { window: { __translations: {} } };

  vm.runInNewContext(fs.readFileSync(langPath, 'utf8'), context, {
    filename: langPath
  });

  return context.window.__translations[lang];
}

function readCanonicalizeVideoUrl(lang = 'en') {
  const canonicalizerPath = path.join(repoRoot, 'assets', 'js', 'video-url-canonicalizer.js');
  const context = {
    URL,
    document: {
      documentElement: { lang }
    },
    window: {
      __translations: translations
    }
  };

  vm.runInNewContext(fs.readFileSync(canonicalizerPath, 'utf8'), context, {
    filename: canonicalizerPath
  });

  return context.window.cuttoVideoUrls.canonicalizeVideoUrl;
}

const timecodesEndpoint = readTimecodesEndpoint();
const translations = {
  en: readTranslations('en'),
  ru: readTranslations('ru')
};
const outputArgKeys = ['original_video_timecodes', 'highlights', 'auto_edit'];

async function openApplicationPage(page) {
  await page.goto(applicationUrl);
  await expect(page.locator('#timecode-request-form')).toBeVisible();
}

async function fillValidRequest(page) {
  await page.locator('#video-path').fill(' https://www.youtube.com/watch?v=dQw4w9WgXcQ ');
  await page.locator('#response-email').fill(' user@example.com ');
  await page.locator('#request-comment').fill(' Please keep technical terms ');
}

async function clickSubmit(page) {
  await page.locator('.request-send-button').click();
}

async function chooseRadio(page, name, value) {
  const input = page.locator(`input[name="${name}"][value="${value}"]`);

  await page.locator('label.request-choice').filter({ has: input }).click();
  await expect(input).toBeChecked();
}

async function chooseOutput(page, output) {
  await page.locator(`.output-card[data-output-card="${output}"] .output-card-main`).click();
}

async function tryDisabledOutput(page, output) {
  await page.locator(`.output-card[data-output-card="${output}"] .output-card-main`).click({ force: true });
}

async function mockTimecodesEndpoint(page, handler) {
  const requests = [];

  await page.route(timecodesEndpoint, async (route) => {
    requests.push(route.request());
    await handler(route);
  });

  return requests;
}

function fulfillJson(route, status, payload) {
  return route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': '*',
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

function parseJsonPost(request) {
  return JSON.parse(request.postData());
}

function getInputsFromRequest(request) {
  return JSON.parse(parseJsonPost(request).inputs_json);
}

function expectOnlyOutputArgs(inputs, expectedKeys) {
  for (const key of outputArgKeys) {
    if (expectedKeys.includes(key)) {
      expect(inputs).toHaveProperty(key);
    } else {
      expect(inputs).not.toHaveProperty(key);
    }
  }
}

test.describe('application page request form', () => {
  test('keeps application translations in parity across supported languages', async () => {
    const ruApplicationKeys = Object.keys(translations.ru)
      .filter((key) => key.startsWith('application.'))
      .sort();

    for (const lang of ['en']) {
      const applicationKeys = Object.keys(translations[lang])
        .filter((key) => key.startsWith('application.'))
        .sort();

      expect(applicationKeys).toEqual(ruApplicationKeys);
    }
  });

  test('canonicalizes supported YouTube and Twitch URL formats', async () => {
    const canonicalizeVideoUrl = readCanonicalizeVideoUrl();
    const cases = [
      ['https://www.youtube.com/watch?v=SE5DyYk1yuk', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://m.youtube.com/watch?v=SE5DyYk1yuk', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://music.youtube.com/watch?v=SE5DyYk1yuk', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://youtu.be/SE5DyYk1yuk?si=abc', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://www.youtube.com/live/_3rNyG-hEeM?si=abc', 'https://www.youtube.com/watch?v=_3rNyG-hEeM', 'youtube'],
      ['https://www.youtube.com/shorts/SE5DyYk1yuk?t=1', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://www.youtube.com/embed/SE5DyYk1yuk?start=10', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://www.youtube.com/v/SE5DyYk1yuk?feature=share', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://www.youtube.com/e/SE5DyYk1yuk?list=PLx', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://www.youtube.com/watch_popup?v=SE5DyYk1yuk', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://www.youtube-nocookie.com/embed/SE5DyYk1yuk', 'https://www.youtube.com/watch?v=SE5DyYk1yuk', 'youtube'],
      ['https://www.youtube.com/watch?v=_3rNyG-hEeM&t=17092s', 'https://www.youtube.com/watch?v=_3rNyG-hEeM', 'youtube'],
      ['https://www.youtube.com/watch?v=rhpj_69Qezg&list=PLx&index=1', 'https://www.youtube.com/watch?v=rhpj_69Qezg', 'youtube'],
      ['https://www.twitch.tv/videos/123456789?t=5m10s', 'https://www.twitch.tv/videos/123456789', 'twitch'],
      ['https://m.twitch.tv/videos/123456789', 'https://www.twitch.tv/videos/123456789', 'twitch'],
      ['https://go.twitch.tv/videos/123456789', 'https://www.twitch.tv/videos/123456789', 'twitch'],
      ['https://www.twitch.tv/somechannel/v/123456789?t=1h', 'https://www.twitch.tv/videos/123456789', 'twitch'],
      ['https://www.twitch.tv/somechannel/video/123456789', 'https://www.twitch.tv/videos/123456789', 'twitch'],
      ['https://player.twitch.tv/?video=123456789&parent=example.com', 'https://www.twitch.tv/videos/123456789', 'twitch'],
      ['https://player.twitch.tv/?video=v123456789', 'https://www.twitch.tv/videos/123456789', 'twitch'],
      ['https://www.twitch.tv/somechannel/schedule?vodID=123456789', 'https://www.twitch.tv/videos/123456789', 'twitch']
    ];

    for (const [rawUrl, canonicalUrl, platform] of cases) {
      expect(canonicalizeVideoUrl(rawUrl)).toEqual({
        ok: true,
        canonicalUrl,
        platform
      });
    }
  });

  test('rejects ambiguous and unsupported video URLs with platform-specific copy', async () => {
    const canonicalizeVideoUrl = readCanonicalizeVideoUrl();
    const youtubeError = translations.en['application.error.youtubeUrl'];
    const twitchError = translations.en['application.error.twitchUrl'];
    const unsupportedError = translations.en['application.error.unsupportedVideoUrl'];

    expect(canonicalizeVideoUrl('https://www.youtube.com/playlist?list=PLx')).toEqual({
      ok: false,
      error: youtubeError,
      platform: 'youtube'
    });
    expect(canonicalizeVideoUrl('https://www.youtube.com/watch?v=SE5DyYk1yuk&v=_3rNyG-hEeM')).toEqual({
      ok: false,
      error: youtubeError,
      platform: 'youtube'
    });
    expect(canonicalizeVideoUrl('https://www.youtube.com/clip/UgkxExample')).toEqual({
      ok: false,
      error: youtubeError,
      platform: 'youtube'
    });
    expect(canonicalizeVideoUrl('https://www.twitch.tv/somechannel')).toEqual({
      ok: false,
      error: twitchError,
      platform: 'twitch'
    });
    expect(canonicalizeVideoUrl('https://player.twitch.tv/?channel=somechannel')).toEqual({
      ok: false,
      error: twitchError,
      platform: 'twitch'
    });
    expect(canonicalizeVideoUrl('https://example.com/watch?v=SE5DyYk1yuk')).toEqual({
      ok: false,
      error: unsupportedError
    });
  });

  test('exposes and uses the configured timecodes endpoint', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);

    await expect.poll(() => (
      page.evaluate(() => window.__siteData.requests.timecodesEndpoint)
    )).toBe(timecodesEndpoint);

    await fillValidRequest(page);
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    expect(requests).toHaveLength(1);
    expect(requests[0].url()).toBe(timecodesEndpoint);
  });

  test('canonicalizes the video input on blur', async ({ page }) => {
    await openApplicationPage(page);

    await expect(page.locator('#video-normalize-notice')).toBeHidden();
    await page.locator('#video-path').fill(' https://youtu.be/SE5DyYk1yuk?si=abc ');
    await page.locator('#video-path').blur();

    await expect(page.locator('#video-path')).toHaveValue('https://www.youtube.com/watch?v=SE5DyYk1yuk');
    await expect(page.locator('#video-normalize-notice')).toBeVisible();
    await expect(page.locator('#video-normalize-notice')).toHaveText('Мы привели ссылку к нужному формату.');

    await page.locator('#video-path').fill('https://www.youtube.com/watch?v=_3rNyG-hEeM');
    await expect(page.locator('#video-normalize-notice')).toBeHidden();
    await page.locator('#video-path').blur();

    await expect(page.locator('#video-path')).toHaveValue('https://www.youtube.com/watch?v=_3rNyG-hEeM');
    await expect(page.locator('#video-normalize-notice')).toBeHidden();
  });

  test('submits only the canonical video_path for non-canonical supported URLs', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await page.locator('#video-path').fill('https://player.twitch.tv/?video=v123456789&parent=cutto.app');
    await page.locator('#response-email').fill('user@example.com');
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');
    expect(requests).toHaveLength(1);
    expect(getInputsFromRequest(requests[0]).user_inputs.video_path).toBe('https://www.twitch.tv/videos/123456789');
  });

  test('blocks unsupported YouTube and Twitch URLs before submit', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await page.locator('#response-email').fill('user@example.com');
    await chooseOutput(page, 'timecodes');

    await page.locator('#video-path').fill('https://www.youtube.com/playlist?list=PLx');
    await clickSubmit(page);

    expect(requests).toHaveLength(0);
    await expect(page.locator('#video-path')).toHaveJSProperty(
      'validationMessage',
      translations.ru['application.error.youtubeUrl']
    );

    await page.locator('#video-path').fill('https://www.twitch.tv/somechannel');
    await clickSubmit(page);

    expect(requests).toHaveLength(0);
    await expect(page.locator('#video-path')).toHaveJSProperty(
      'validationMessage',
      translations.ru['application.error.twitchUrl']
    );
  });

  test('shows exact English canonicalization errors after language switch', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await page.locator('.lang-btn[data-lang="en"]').click();
    await page.locator('#video-path').fill('https://www.youtube.com/playlist?list=PLx');
    await page.locator('#response-email').fill('user@example.com');
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    expect(requests).toHaveLength(0);
    await expect(page.locator('#video-path')).toHaveJSProperty(
      'validationMessage',
      'Please paste a YouTube link to a specific video. Playlists, channels, clips, and search pages are not supported.'
    );
  });

  test('starts with default radio options selected and no output selected', async ({ page }) => {
    await openApplicationPage(page);

    await expect(page).toHaveTitle('Обработать моё видео с CUTTO');
    await expect(page.locator('.application-hero h1')).toHaveText('Обработать моё видео с CUTTO');
    await expect(page.locator('label[for="video-path"] span')).toHaveText('YouTube или Twitch видео');
    await expect(page.locator('.output-picker legend span')).toHaveText('Что создать?');
    await expect(page.locator('.output-card[data-output-card="timecodes"] .output-title')).toHaveText('Таймкоды для исходного видео');
    await expect(page.locator('.output-card[data-output-card="timecodes"] .output-description')).toHaveText('Получите список глав в формате YouTube');
    await expect(page.locator('.output-card[data-output-card="highlights"] .output-title')).toHaveText('Хайлайты');
    await expect(page.locator('.output-card[data-output-card="highlights"] .output-description')).toHaveText('Получите короткие клипы из самых интересных моментов');
    await expect(page.locator('.output-card[data-output-card="auto-edit"] .output-title')).toHaveText('Автомонтаж');
    await expect(page.locator('.output-card[data-output-card="auto-edit"] .output-description')).toHaveText('Получите укороченное видео');
    await expect(page.locator('.output-card[data-output-card="highlights"] .output-toggle .output-unavailable')).toHaveText('В разработке');
    await expect(page.locator('.output-card[data-output-card="auto-edit"] .output-unavailable')).toHaveText('В разработке');

    const formOrder = await page.evaluate(() => {
      const outputPicker = document.querySelector('.output-picker');
      const emailField = document.getElementById('response-email').closest('.request-field');
      const commentField = document.getElementById('request-comment').closest('.request-field');
      const sendButton = document.querySelector('.request-send-button');

      return Boolean(outputPicker.compareDocumentPosition(emailField) & Node.DOCUMENT_POSITION_FOLLOWING)
        && Boolean(emailField.compareDocumentPosition(commentField) & Node.DOCUMENT_POSITION_FOLLOWING)
        && Boolean(commentField.compareDocumentPosition(sendButton) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    const disclaimerStyle = await page.locator('.request-disclaimer').evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        backgroundColor: style.backgroundColor,
        borderTopColor: style.borderTopColor,
        borderRadius: style.borderTopLeftRadius
      };
    });

    expect(formOrder).toBe(true);
    await expect(page.locator('.request-disclaimer')).toContainText('Если вы ВПЕРВЫЕ используете сервис');
    await expect(page.locator('.request-disclaimer svg')).toBeVisible();
    expect(disclaimerStyle.backgroundColor).toBe('rgb(255, 247, 237)');
    expect(disclaimerStyle.borderTopColor).toBe('rgb(254, 215, 170)');
    expect(parseFloat(disclaimerStyle.borderRadius)).toBeGreaterThanOrEqual(8);
    await expect(page.locator('input[name="language-code"][value="ru"]')).toBeChecked();
    await expect(page.locator('input[name="detect-speakers"]')).toHaveCount(0);
    await expect(page.locator('#output-timecodes')).not.toBeChecked();
    await expect(page.locator('#output-highlights')).not.toBeChecked();
    await expect(page.locator('#output-auto-edit')).not.toBeChecked();
    await expect(page.locator('#output-highlights')).toBeEnabled();
    await expect(page.locator('#output-auto-edit')).toBeDisabled();
    await expect(page.locator('#highlight-thumbnails')).toBeDisabled();
    await expect(page.locator('#highlight-thumbnails')).not.toBeChecked();
    await expect(page.locator('.output-card[data-output-card="highlights"]')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('.output-card[data-output-card="auto-edit"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toHaveClass(/request-send-button--blocked/);
    await expect(page.locator('[data-output-panel="timecodes"]')).toHaveCount(0);
    await expect(page.locator('[data-output-panel="highlights"]')).toBeHidden();
    await expect(page.locator('[data-output-panel="auto-edit"]')).toBeHidden();
  });

  test('translates redesigned application copy to English', async ({ page }) => {
    await openApplicationPage(page);

    await page.locator('.lang-btn[data-lang="en"]').click();

    await expect(page).toHaveTitle('Process my video with CUTTO');
    await expect(page.locator('.application-hero h1')).toHaveText('Process my video with CUTTO');
    await expect(page.locator('label[for="video-path"] span')).toHaveText('YouTube or Twitch video link');
    await expect(page.locator('.request-disclaimer')).toContainText('If this is your FIRST TIME using the service');
    await expect(page.locator('.output-card[data-output-card="highlights"] .output-toggle .output-unavailable')).toHaveText('Under development');
    await expect(page.locator('.output-card[data-output-card="auto-edit"] .output-unavailable')).toHaveText('Under development');

    const englishDescriptions = await page.locator('.output-card .output-description').allTextContents();
    expect(englishDescriptions).toEqual([
      'Get a chapter list in YouTube format',
      'Get short clips of the most interesting parts',
      'Get a shortened video'
    ]);
    for (const description of englishDescriptions) {
      expect(description.startsWith('Get ')).toBe(true);
      expect(description).not.toMatch(/you get/i);
    }
  });

  test('allows timecodes and highlights while keeping auto-edit unavailable', async ({ page }) => {
    await openApplicationPage(page);

    await tryDisabledOutput(page, 'auto-edit');

    await expect(page.locator('#output-highlights')).not.toBeChecked();
    await expect(page.locator('#output-auto-edit')).not.toBeChecked();
    await expect(page.locator('[data-output-panel="highlights"]')).toBeHidden();
    await expect(page.locator('[data-output-panel="auto-edit"]')).toBeHidden();
    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toHaveClass(/request-send-button--blocked/);

    await chooseOutput(page, 'timecodes');

    await expect(page.locator('#output-timecodes')).toBeChecked();
    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('[data-output-panel="timecodes"]')).toHaveCount(0);
    await expect(page.locator('[data-output-panel="highlights"]')).toBeHidden();
    await expect(page.locator('[data-output-panel="auto-edit"]')).toBeHidden();

    await chooseOutput(page, 'highlights');

    await expect(page.locator('#output-highlights')).toBeChecked();
    await expect(page.locator('.output-card[data-output-card="highlights"]')).toHaveClass(/is-selected/);
    await expect(page.locator('[data-output-panel="highlights"]')).toBeVisible();
    await expect(page.locator('#highlights-count')).toHaveValue('5');
    await expect(page.locator('#highlight-thumbnails')).toBeDisabled();
    await expect(page.locator('#highlight-thumbnails')).not.toBeChecked();
    await page.locator('label[for="highlight-thumbnails"]').click({ force: true });
    await expect(page.locator('#highlight-thumbnails')).not.toBeChecked();
    await expect(page.locator('[data-output-panel="auto-edit"]')).toBeHidden();
    await expect(page.locator('#output-auto-edit')).not.toBeChecked();

    await chooseOutput(page, 'highlights');

    await expect(page.locator('#output-highlights')).not.toBeChecked();
    await expect(page.locator('[data-output-panel="highlights"]')).toBeHidden();
    await expect(page.locator('.request-send-button')).toBeEnabled();

    await chooseOutput(page, 'timecodes');

    await expect(page.locator('#output-timecodes')).not.toBeChecked();
    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toHaveClass(/request-send-button--blocked/);
  });

  test('does not submit when valid contact fields are filled but no output is selected', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await page.locator('#video-path').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.locator('#response-email').fill('user@example.com');
    await page.locator('#response-email').press('Enter');
    await page.locator('#timecode-request-form').dispatchEvent('submit');
    await page.waitForTimeout(100);

    expect(requests).toHaveLength(0);
    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toHaveClass(/request-send-button--blocked/);
  });

  test('does not submit unavailable auto-edit output', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await fillValidRequest(page);
    await tryDisabledOutput(page, 'auto-edit');
    await expect(page.locator('#output-highlights')).not.toBeChecked();
    await expect(page.locator('#output-auto-edit')).not.toBeChecked();
    await expect(page.locator('[data-output-panel="highlights"]')).toBeHidden();
    await expect(page.locator('[data-output-panel="auto-edit"]')).toBeHidden();
    await page.locator('#timecode-request-form').dispatchEvent('submit');
    await page.waitForTimeout(100);

    expect(requests).toHaveLength(0);
    await expect(page.locator('.request-send-button')).toBeDisabled();
  });

  test('required and native validation prevent requests', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);

    await expect(page.locator('.request-send-button')).toBeDisabled();

    await chooseOutput(page, 'timecodes');

    await clickSubmit(page);
    expect(requests).toHaveLength(0);

    await page.locator('#video-path').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await clickSubmit(page);
    expect(requests).toHaveLength(0);

    await page.locator('#response-email').fill('not-an-email');
    await clickSubmit(page);
    expect(requests).toHaveLength(0);
  });

  test('submits default options and empty comment when optional controls are unchanged', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await page.locator('#video-path').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.locator('#response-email').fill('user@example.com');
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');

    expect(requests).toHaveLength(1);

    const payload = parseJsonPost(requests[0]);
    expect(payload.comment).toBe('');
    const inputs = getInputsFromRequest(requests[0]);
    expect(inputs).toEqual({
      user_inputs: {
        video_path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        language_code: 'ru',
        detect_speakers: 'TRUE'
      },
      original_video_timecodes: {}
    });
    expectOnlyOutputArgs(inputs, ['original_video_timecodes']);
  });

  test('submits highlights with count and disabled thumbnails flag', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await fillValidRequest(page);
    await chooseOutput(page, 'highlights');

    await expect(page.locator('[data-output-panel="highlights"]')).toBeVisible();
    await expect(page.locator('#highlight-thumbnails')).toBeDisabled();
    await page.locator('label[for="highlight-thumbnails"]').click({ force: true });
    await expect(page.locator('#highlight-thumbnails')).not.toBeChecked();

    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');
    expect(requests).toHaveLength(1);

    const inputs = getInputsFromRequest(requests[0]);
    expect(inputs).toEqual({
      user_inputs: {
        video_path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        language_code: 'ru',
        detect_speakers: 'TRUE'
      },
      highlights: {
        num_clips: 5,
        thumbnails_needed: false
      }
    });
    expectOnlyOutputArgs(inputs, ['highlights']);
  });

  test('submits trimmed payload and marks the request as sent', async ({ page }) => {
    let releaseResponse;
    const responseIsReleased = new Promise((resolve) => {
      releaseResponse = resolve;
    });
    const requests = await mockTimecodesEndpoint(page, async (route) => {
      await responseIsReleased;
      await fulfillJson(route, 200, { ok: true });
    });

    await openApplicationPage(page);
    await fillValidRequest(page);
    await chooseRadio(page, 'language-code', 'en');
    await chooseOutput(page, 'timecodes');

    const submitPromise = clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toContainText('Отправляем...');

    releaseResponse();
    await submitPromise;

    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');
    expect(requests).toHaveLength(1);
    expect(requests[0].method()).toBe('POST');
    expect(requests[0].headers()['content-type']).toContain('text/plain;charset=utf-8');

    const payload = parseJsonPost(requests[0]);
    expect(payload).toMatchObject({
      email: 'user@example.com',
      comment: 'Please keep technical terms'
    });
    expect(payload).not.toHaveProperty('pipeline');
    expect(payload.requested_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(payload.requested_at))).toBe(false);
    expect(new Date(payload.requested_at).toISOString()).toBe(payload.requested_at);
    const inputs = getInputsFromRequest(requests[0]);
    expect(inputs).toEqual({
      user_inputs: {
        video_path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        language_code: 'en',
        detect_speakers: 'TRUE'
      },
      original_video_timecodes: {}
    });
    expectOnlyOutputArgs(inputs, ['original_video_timecodes']);
  });

  test('does not submit twice while a request is pending', async ({ page }) => {
    let releaseResponse;
    const responseIsReleased = new Promise((resolve) => {
      releaseResponse = resolve;
    });
    const requests = await mockTimecodesEndpoint(page, async (route) => {
      await responseIsReleased;
      await fulfillJson(route, 200, { ok: true });
    });

    await openApplicationPage(page);
    await fillValidRequest(page);
    await chooseOutput(page, 'timecodes');

    const submitPromise = clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect.poll(() => requests.length).toBe(1);

    await page.locator('#response-email').press('Enter');
    await page.locator('#request-comment').press('Enter');
    await page.waitForTimeout(100);

    expect(requests).toHaveLength(1);

    releaseResponse();
    await submitPromise;

    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');
    expect(requests).toHaveLength(1);
  });

  test('resets the sent state after editing the submitted form', async ({ page }) => {
    await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);
    await fillValidRequest(page);
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');

    await page.locator('#request-comment').fill('Updated comment');

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Создать');

    await clickSubmit(page);
    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');

    await tryDisabledOutput(page, 'auto-edit');

    await expect(page.locator('#output-auto-edit')).not.toBeChecked();
    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');
  });

  test('resets the form and alerts when the server returns HTTP error', async ({ page }) => {
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 500, { ok: false }));

    await openApplicationPage(page);
    await fillValidRequest(page);
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Создать');
    expect(requests).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Не удалось зарегистрировать запрос. Попробуйте еще раз.');
    expect(alerts[0]).toContain('HTTP 500');
  });

  test('resets the form and alerts when the server rejects the request', async ({ page }) => {
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });
    const requests = await mockTimecodesEndpoint(page, (route) => (
      fulfillJson(route, 200, { ok: false, error: 'Quota exceeded' })
    ));

    await openApplicationPage(page);
    await fillValidRequest(page);
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Создать');
    expect(requests).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Не удалось зарегистрировать запрос. Попробуйте еще раз.');
    expect(alerts[0]).toContain('Quota exceeded');
  });

  test('resets the form and alerts when the server returns malformed JSON', async ({ page }) => {
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });
    const requests = await mockTimecodesEndpoint(page, (route) => (
      route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json'
        },
        body: 'not json'
      })
    ));

    await openApplicationPage(page);
    await fillValidRequest(page);
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Создать');
    expect(requests).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Не удалось зарегистрировать запрос. Попробуйте еще раз.');
  });

  test('uses English submit states and errors after language switch', async ({ page }) => {
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    });
    const requests = await mockTimecodesEndpoint(page, (route) => (
      fulfillJson(route, 200, { ok: false, error: 'Quota exceeded' })
    ));

    await openApplicationPage(page);
    await page.locator('.lang-btn[data-lang="en"]').click();
    await expect(page.locator('.request-send-button')).toContainText('Create');
    await expect(page.locator('.request-disclaimer')).toContainText('If this is your FIRST TIME using the service');

    await fillValidRequest(page);
    await chooseOutput(page, 'timecodes');
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Create');
    expect(requests).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Failed to register request. Please try again.');
    expect(alerts[0]).toContain('Quota exceeded');
  });
});
