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

const timecodesEndpoint = readTimecodesEndpoint();

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

test.describe('application page request form', () => {
  test('exposes and uses the configured timecodes endpoint', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);

    await expect.poll(() => (
      page.evaluate(() => window.__siteData.requests.timecodesEndpoint)
    )).toBe(timecodesEndpoint);

    await fillValidRequest(page);
    await clickSubmit(page);

    expect(requests).toHaveLength(1);
    expect(requests[0].url()).toBe(timecodesEndpoint);
  });

  test('starts with default radio options selected', async ({ page }) => {
    await openApplicationPage(page);

    await expect(page.locator('input[name="language-code"][value="ru"]')).toBeChecked();
    await expect(page.locator('input[name="detect-speakers"][value="FALSE"]')).toBeChecked();
  });

  test('required and native validation prevent requests', async ({ page }) => {
    const requests = await mockTimecodesEndpoint(page, (route) => fulfillJson(route, 200, { ok: true }));

    await openApplicationPage(page);

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
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');

    expect(requests).toHaveLength(1);

    const payload = parseJsonPost(requests[0]);
    expect(payload.comment).toBe('');
    expect(JSON.parse(payload.inputs_json)).toEqual({
      video_path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      language_code: 'ru',
      detect_speakers: 'FALSE'
    });
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
    await chooseRadio(page, 'detect-speakers', 'TRUE');

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
      pipeline: 'timecodes',
      comment: 'Please keep technical terms'
    });
    expect(payload.requested_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(payload.requested_at))).toBe(false);
    expect(new Date(payload.requested_at).toISOString()).toBe(payload.requested_at);
    expect(JSON.parse(payload.inputs_json)).toEqual({
      video_path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      language_code: 'en',
      detect_speakers: 'TRUE'
    });
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
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeDisabled();
    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');

    await page.locator('#request-comment').fill('Updated comment');

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Создать');

    await clickSubmit(page);
    await expect(page.locator('.request-send-button')).toContainText('Ваш запрос отправлен');

    await chooseRadio(page, 'detect-speakers', 'TRUE');

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Создать');
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

    await fillValidRequest(page);
    await clickSubmit(page);

    await expect(page.locator('.request-send-button')).toBeEnabled();
    await expect(page.locator('.request-send-button')).toContainText('Create');
    expect(requests).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Failed to register request. Please try again.');
    expect(alerts[0]).toContain('Quota exceeded');
  });
});
