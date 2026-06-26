const fs = require('fs');
const path = require('path');

const reportDir = path.join(process.cwd(), 'reports');
const cucumberReportPath = path.join(reportDir, 'cucumber-report.json');
const applitoolsReportPath = path.join(reportDir, 'applitools-classification-cucumber.json');
const htmlReportPath = path.join(reportDir, 'applitools-report.html');

function safeJson(pathName) {
  if (!fs.existsSync(pathName)) return null;
  try {
    return JSON.parse(fs.readFileSync(pathName, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse JSON file ${pathName}:`, err.message);
    return null;
  }
}

function classifyScenario(name, error) {
  if (/ENV_FAIL/i.test(name)) return 'Environment';
  if (/SCRIPT_FAIL/i.test(name)) return 'Script';
  if (/AssertionError|expected.*to equal|expected.*to include|expected.*to contain|expected.*to.*equal|expected.*to.*contain/i.test(error)) return 'Bug';
  if (/timeout|ECONN|connect|launch|DNS|ENOTFOUND|ETIMEDOUT|browser failed/i.test(error)) return 'Environment';
  return 'Script';
}

function formatValue(value) {
  return value == null ? '-' : String(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const cucumber = safeJson(cucumberReportPath);
const applitools = safeJson(applitoolsReportPath) || [];

if (!cucumber) {
  console.error('Cannot generate Applitools HTML report: cucumber report not found or invalid.');
  process.exit(1);
}

if (!applitools) {
  console.error('Cannot generate Applitools HTML report: applitools-classification-cucumber.json not found or invalid.');
  process.exit(1);
}

const cucumberFailures = new Map();
for (const feature of cucumber) {
  const featureName = feature.name || 'Unknown feature';
  const elements = feature.elements || [];
  for (const scenario of elements) {
    if (scenario.type !== 'scenario') continue;
    const failedSteps = (scenario.steps || []).filter(step => step.result && step.result.status === 'failed');
    if (!failedSteps.length) continue;
    const name = scenario.name || 'Unnamed scenario';
    const errorMessages = failedSteps.map(step => {
      const message = step.result && step.result.error_message ? step.result.error_message : '';
      return `${step.keyword}${step.name}: ${message}`.trim();
    }).join('\n');
    cucumberFailures.set(name, { featureName, name, error: errorMessages || 'No failure message available' });
  }
}

const groups = {
  Environment: [],
  Script: [],
  Bug: [],
};
const seenScenarios = new Set();

for (const entry of applitools) {
  if (!entry || !entry.name) continue;
  const cucumberData = cucumberFailures.get(entry.name);
  const name = entry.name;
  let classification = entry.classification || classifyScenario(name, entry.exception || '');
  if (/ENV_FAIL/i.test(name)) classification = 'Environment';
  else if (/SCRIPT_FAIL/i.test(name)) classification = 'Script';
  else if (!entry.classification) classification = classifyScenario(name, entry.exception || '');

  const feature = cucumberData?.featureName || 'Unknown feature';
  const error = cucumberData?.error || entry.exception || 'No failure message available';
  const applitoolsUrl = entry.url || null;

  groups[classification].push({
    feature,
    scenario: name,
    error,
    applitoolsUrl,
    baselineId: entry.baselineId || null,
    mismatches: entry.mismatches ?? null,
    matches: entry.matches ?? null,
    missing: entry.missing ?? null,
    steps: entry.steps || [],
  });
  seenScenarios.add(name);
}

for (const [name, data] of cucumberFailures) {
  if (seenScenarios.has(name)) continue;
  let classification = classifyScenario(name, data.error);
  if (/ENV_FAIL/i.test(name)) classification = 'Environment';
  else if (/SCRIPT_FAIL/i.test(name)) classification = 'Script';

  groups[classification].push({
    feature: data.featureName,
    scenario: name,
    error: data.error,
    applitoolsUrl: null,
    baselineId: null,
    mismatches: null,
    matches: null,
    missing: null,
    steps: [],
  });
}

const totalFailed = groups.Environment.length + groups.Script.length + groups.Bug.length;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Applitools Failure Classification Report</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; line-height: 1.5; }
  h1, h2, h3 { color: #333; }
  .summary { margin-bottom: 24px; }
  .group { margin-bottom: 32px; }
  .group h2 { margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  .bug th { background: #fdecea; }
  .script th { background: #fff4e5; }
  .environment th { background: #e8f4fd; }
  .small { font-size: 0.9em; color: #555; }
  pre { background: #f4f4f4; padding: 8px; overflow-x: auto; }
  a { color: #1a73e8; }
</style>
</head>
<body>
<h1>Applitools Failure Classification Report</h1>
<div class="summary">
  <p><strong>Total failed scenarios:</strong> ${totalFailed}</p>
  <p><strong>Environment issues:</strong> ${groups.Environment.length}</p>
  <p><strong>Script issues:</strong> ${groups.Script.length}</p>
  <p><strong>Bug issues:</strong> ${groups.Bug.length}</p>
</div>
${['Environment', 'Script', 'Bug'].map(category => {
  const items = groups[category];
  return `
  <div class="group ${category.toLowerCase()}">
    <h2>${category} Issues (${items.length})</h2>
    ${items.length === 0 ? '<p>No scenarios in this category.</p>' : `
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Scenario</th>
            <th>Error</th>
            <th>Applitools</th>
            <th>Baseline ID</th>
            <th>Results</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${escapeHtml(item.feature)}</td>
              <td>${escapeHtml(item.scenario)}</td>
              <td><pre>${escapeHtml(item.error)}</pre></td>
              <td>${item.applitoolsUrl ? `<a href="${escapeHtml(item.applitoolsUrl)}" target="_blank">View</a>` : 'N/A'}</td>
              <td>${escapeHtml(item.baselineId)}</td>
              <td>
                Matches: ${formatValue(item.matches)}<br>
                Mismatches: ${formatValue(item.mismatches)}<br>
                Missing: ${formatValue(item.missing)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}
  </div>
  `;
}).join('')}
</body>
</html>`;

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(htmlReportPath, html, 'utf8');
console.log(`Applitools HTML report written to ${htmlReportPath}`);
