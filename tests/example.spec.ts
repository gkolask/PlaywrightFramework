import { test, expect } from '@playwright/test';
import { Eyes, VisualGridRunner, Target, Configuration } from '@applitools/eyes-playwright';
import fs from 'fs';
import path from 'path';

const runner = new VisualGridRunner({ testConcurrency: 5 });
const eyes = new Eyes(runner);

// Ensure API key is set for Eyes (falls back to env var if present)
const config = new Configuration();
config.setApiKey(process.env.APPLITOOLS_API_KEY || 'zxVw5spWunHC6RXQa99VL72x2pfoqUeq6HXTEV8PO107JU110');
config.setBatch({ name: 'PlaywrightFramework Batch' });
eyes.setConfiguration(config);

test('basic example.com visual smoke test', async ({ page }) => {
  await page.goto('https://example.com');

  await eyes.open(page, 'PlaywrightFramework', 'Example Domain test');
  await eyes.check('Main page', Target.window().fully());
  await eyes.close();

  await expect(page).toHaveTitle(/Example Domain/);
});

test.afterAll(async () => {
  const summary = await runner.getAllTestResults(false);

  // Normalize results array from different SDK shapes
  let rawResults = [];
  try {
    if (typeof summary.getAllResults === 'function') rawResults = summary.getAllResults();
    else if (summary && summary._summary && Array.isArray(summary._summary.results)) rawResults = summary._summary.results;
    else rawResults = [summary];
  } catch (e) {
    rawResults = [summary];
  }

  const report = [];
  for (const r of rawResults) {
    const t = r.testResults || r;
    const name = t?.name || (t?.getName && t.getName()) || 'unknown';
    const url = t?.url || (t?.getUrl && typeof t.getUrl === 'function' ? t.getUrl() : null) || null;
    const mismatches = (t && (t.mismatches ?? t.mismatch)) ?? (r && (r.mismatches ?? 0)) ?? 0;
    const matches = (t && (t.matches ?? 0)) ?? 0;
    const missing = (t && (t.missing ?? 0)) ?? 0;
    const exception = r && r.exception ? (r.exception.message || String(r.exception)) : null;

    // Baseline ID extraction (try common fields)
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
    } catch (err) {
      baselineId = null;
    }

    // Steps extraction (attempt multiple common shapes)
    let steps = [];
    try {
      const stepKeyCandidates = Object.keys(t || {}).filter(k => /steps|actualAppOutput|stepsInfo/i.test(k));
      for (const k of stepKeyCandidates) {
        const arr = t[k];
        if (!arr) continue;
        if (Array.isArray(arr)) {
          for (const s of arr) {
            const step = {
              name: s?.name || s?.tag || s?.title || null,
              isMatching: (s?.isMatching ?? s?.isSame ?? s?.asExpected) ?? null,
              screenshot: s?.screenshot || s?.image || s?.screenshotUrl || s?.imageUrl || null,
              stepIndex: s?.stepIndex ?? s?.index ?? null,
            };
            steps.push(step);
          }
          break;
        }
      }
      // fallback: check nested actualAppOutput in r
      if (steps.length === 0 && Array.isArray(r?.actualAppOutput)) {
        for (const s of r.actualAppOutput) {
          steps.push({ name: s?.tag || null, screenshot: s?.image || null });
        }
      }
    } catch (err) {
      steps = [];
    }

    let classification = 'Bug';
    if (exception) {
      if (/timeout|ECONN|connect|launch|DNS|ENOTFOUND|ETIMEDOUT/i.test(exception)) classification = 'Env';
      else classification = 'Script';
    } else if (mismatches > 0) classification = 'Bug';

    report.push({ name, url, mismatches, matches, missing, baselineId, steps, exception, classification });
  }

  const outDir = path.join(process.cwd(), 'reports');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'applitools-classification.json'), JSON.stringify(report, null, 2));
    console.log('Wrote', path.join('reports', 'applitools-classification.json'));
  } catch (err) {
    console.error('Failed to write Applitools classification report', err);
  }
});
