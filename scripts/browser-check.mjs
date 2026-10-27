import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
for (const faction of ['HUMANS', 'DARK ELVES', 'THE CORRUPTED']) {
  await page.goto(process.env.GODFALL_URL || 'http://127.0.0.1:5173');
  await page.getByRole('button').filter({has: page.getByText(faction, {exact:true})}).click();
  await page.getByRole('button', {name:'Begin the Flesh War'}).click();
  await page.waitForTimeout(4000);
  assert.equal(await page.locator('canvas').count(), 2);
  await page.keyboard.press('h');
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:'Resume',exact:true}).click();
}
await page.screenshot({path:'/tmp/godfall-game.png'});
await page.goto(process.env.GODFALL_URL || 'http://127.0.0.1:5173');
await page.screenshot({path:'/tmp/godfall-title.png'});
await page.setViewportSize({width:390,height:844});
assert.equal(await page.locator('.faction-card').count(),3);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
assert.deepEqual(errors, []);
console.log('All factions launch; selection, pause/resume, mobile menu and browser errors checked.');
await browser.close();
