const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://docs.globalgetnet.com/en/articles?article=currency-codes', { waitUntil: 'networkidle' });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 2500));
  await browser.close();
})();
