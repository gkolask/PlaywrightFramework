const fs = require('fs');
const path = require('path');
const { setWorldConstructor, Before, After, AfterStep, AfterAll } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const { Eyes, VisualGridRunner, Target, Configuration } = require('@applitools/eyes-playwright');

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

// Applitools runner shared across scenarios
const runner = new VisualGridRunner({ testConcurrency: 5 });
const sharedConfig = new Configuration();
if (process.env.APPLITOOLS_API_KEY && process.env.APPLITOOLS_API_KEY.trim() !== '') {
  sharedConfig.setApiKey(process.env.APPLITOOLS_API_KEY);
}
sharedConfig.setBatch({ name: 'PlaywrightFramework Batch' });

Before(async function ({ pickle }) {
  const scenarioName = (pickle && pickle.name) ? pickle.name : `Scenario ${Date.now()}`;
  this.currentScenarioName = scenarioName;

  // Simulate environment failure for scenarios naming convention
  if (scenarioName.includes('ENV_FAIL')) {
    throw new Error('Simulated environment failure: browser failed to start');
  }

  this.browser = await chromium.launch({ headless: true });
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();

  // Create Eyes per scenario to avoid conflicts and attach runner
  const eyes = new Eyes(runner);
  eyes.setConfiguration(sharedConfig);
  this.eyes = eyes;

  try {
    await this.eyes.open(this.page, 'PlaywrightFramework', scenarioName);
  } catch (err) {
    // continue even if Eyes open fails
    console.warn('Eyes open failed:', err && err.message ? err.message : err);
  }
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
  // Optionally also send step-level checkpoint to Applitools (commented out by default)
  try {
    // await this.eyes.check(pickleStep.text || 'step', Target.window().fully());
  } catch (e) {
    // ignore
  }
});

After(async function () {
  // take a final visual checkpoint for the scenario
  try {
    if (this.eyes && this.page) await this.eyes.check('Final', Target.window().fully());
    if (this.eyes) await this.eyes.close();
  } catch (err) {
    if (this.eyes) await this.eyes.abort();
  }

  if (this.page) await this.page.close();
  if (this.context) await this.context.close();
  if (this.browser) await this.browser.close();
});

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((err) => {
      clearTimeout(timer);
      console.error('Promise failed inside timeout wrapper:', err);
      resolve(null);
    });
  });
}

// After all features, gather Applitools runner results and write a classification report
AfterAll({ timeout: 120 * 1000 }, async function () {
  try {
    if (!process.env.APPLITOOLS_API_KEY || process.env.APPLITOOLS_API_KEY.trim() === '') {
      console.warn('Skipping Applitools summary: APPLITOOLS_API_KEY is not set.');
      fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
      fs.writeFileSync(path.join(process.cwd(), 'reports', 'applitools-classification-cucumber.json'), JSON.stringify([], null, 2));
      return;
    }

    const summary = await withTimeout(runner.getAllTestResults(false), 45 * 1000);
    if (!summary) {
      console.warn('Applitools runner summary timed out or failed. Writing empty classification report.');
      fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
      fs.writeFileSync(path.join(process.cwd(), 'reports', 'applitools-classification-cucumber.json'), JSON.stringify([], null, 2));
      return;
    }

    // normalize
    let rawResults = [];
    if (typeof summary.getAllResults === 'function') rawResults = summary.getAllResults();
    else if (summary && summary._summary && Array.isArray(summary._summary.results)) rawResults = summary._summary.results;
    else rawResults = [summary];

    const report = [];
    for (const r of rawResults) {
      const t = r.testResults || r;
      const name = t?.name || (t?.getName && t.getName()) || 'unknown';
      const url = t?.url || (t?.getUrl && typeof t.getUrl === 'function' ? t.getUrl() : null) || null;
      const mismatches = (t && (t.mismatches ?? t.mismatch)) ?? (r && (r.mismatches ?? 0)) ?? 0;
      const matches = (t && (t.matches ?? 0)) ?? 0;
      const missing = (t && (t.missing ?? 0)) ?? 0;
      const exception = r && r.exception ? (r.exception.message || String(r.exception)) : null;

      // baselineId
      let baselineId = null;
      try {
        const candKeys = Object.keys(t || {}).filter(k => /baseline/i.test(k));
        for (const k of candKeys) {
          const v = t[k];
          if (!v) continue;
          if (typeof v === 'string') { baselineId = v; break; }
          if (typeof v === 'object') { baselineId = v.id || v.name || JSON.stringify(v); break; }
        }
        if (!baselineId && typeof t?.getBaselineId === 'function') baselineId = t.getBaselineId();
      } catch (err) { baselineId = null; }

      // steps
      let steps = [];
      try {
        const stepKeyCandidates = Object.keys(t || {}).filter(k => /steps|actualAppOutput|stepsInfo/i.test(k));
        for (const k of stepKeyCandidates) {
          const arr = t[k];
          if (!arr) continue;
          if (Array.isArray(arr)) {
            for (const s of arr) {
              steps.push({ name: s?.name || s?.tag || s?.title || null, isMatching: (s?.isMatching ?? s?.isSame ?? s?.asExpected) ?? null, screenshot: s?.screenshot || s?.image || s?.screenshotUrl || s?.imageUrl || null, stepIndex: s?.stepIndex ?? s?.index ?? null });
            }
            break;
          }
        }
        if (steps.length === 0 && Array.isArray(r?.actualAppOutput)) {
          for (const s of r.actualAppOutput) steps.push({ name: s?.tag || null, screenshot: s?.image || null });
        }
      } catch (err) { steps = []; }

      let classification = 'Bug';
      if (exception) {
        if (/timeout|ECONN|connect|launch|DNS|ENOTFOUND|ETIMEDOUT/i.test(exception)) classification = 'Env';
        else classification = 'Script';
      } else if (/ENV_FAIL/i.test(name)) {
        classification = 'Env';
      } else if (/SCRIPT_FAIL/i.test(name)) {
        classification = 'Script';
      } else if (mismatches > 0) {
        classification = 'Bug';
      }

      report.push({ name, url, mismatches, matches, missing, baselineId, steps, exception, classification });
    }

    const outDir = path.join(process.cwd(), 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'applitools-classification-cucumber.json'), JSON.stringify(report, null, 2));
    console.log('Wrote', path.join('reports', 'applitools-classification-cucumber.json'));
  } catch (err) {
    console.error('Failed to produce Applitools cucumber classification report', err);
  }
});
