const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://docs.globalgetnet.com/en/products/online-payments/regional-api', { waitUntil: 'networkidle' });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 3000));
  await browser.close();
})();
