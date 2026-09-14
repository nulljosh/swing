import { chromium } from 'playwright-core';

const origin = process.env.SWING_QA_URL || 'http://localhost:8789';
const executablePath = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

try {
  const contexts = await Promise.all([0, 1].map(() =>
    browser.newContext({ permissions: ['camera', 'microphone'] })));
  const [first, second] = await Promise.all(contexts.map(c => c.newPage()));
  for (const page of [first, second]) {
    await page.goto(`${origin}/app`);
    if (await page.locator('#gate').isVisible()) await page.locator('#agree').click();
  }
  await first.locator('#handle').fill('@first');
  await second.locator('#handle').fill('@second');
  await first.locator('#start').click();
  await second.locator('#start').click();
  await Promise.all([first, second].map(page =>
    page.locator('#status').getByText('Connected').waitFor({ timeout: 20000 })));

  for (const page of [first, second]) {
    const tracks = await page.evaluate(() => ({
      local: document.querySelector('#local').srcObject?.getTracks().map(t => t.kind).sort(),
      remote: document.querySelector('#remote').srcObject?.getTracks().map(t => t.kind).sort(),
    }));
    for (const side of ['local', 'remote']) {
      if (tracks[side]?.join(',') !== 'audio,video')
        throw new Error(`${side} audio/video missing: ${JSON.stringify(tracks)}`);
    }
  }

  await first.locator('#text').fill('hello');
  await first.locator('#say button').click();
  await second.locator('#log').getByText('hello').waitFor();
  for (const page of [first, second]) await page.evaluate(() => document.querySelector('#more').click());
  for (const page of [first, second]) await page.evaluate(() => document.querySelector('#keep').click());
  await first.locator('#banner').getByText('@second').waitFor();
  await first.evaluate(() => document.querySelector('#next').click());
  await second.locator('#status').getByText('Looking for someone').waitFor();
  for (const page of [first, second]) await page.locator('#stop').click();
  console.log('Solo call QA passed: media, chat, extend, keep, next, disconnect.');
} finally {
  await browser.close();
}
