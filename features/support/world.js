const fs = require('fs');
const path = require('path');
const { setWorldConstructor, Before, After, AfterStep } = require('@cucumber/cucumber');
const { chromium } = require('playwright');

class CustomWorld {
  constructor({ attach }) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.examplePage = null;
    this.attach = attach;
  }
}

setWorldConstructor(CustomWorld);

Before(async function () {
  this.browser = await chromium.launch({ headless: true });
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();
});

AfterStep(async function ({ pickleStep }) {
  if (!this.page || !this.attach) return;

  const screenshotsDir = path.join(process.cwd(), 'reports', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const safeStepText = pickleStep.text.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_').slice(0, 80);
  const fileName = `${Date.now()}-${safeStepText}.png`;
  const filePath = path.join(screenshotsDir, fileName);

  const screenshotBuffer = await this.page.screenshot({ path: filePath, fullPage: true });
  await this.attach(screenshotBuffer, 'image/png');
});

After(async function () {
  if (this.page) await this.page.close();
  if (this.context) await this.context.close();
  if (this.browser) await this.browser.close();
});
