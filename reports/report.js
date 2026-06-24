const reporter = require('cucumber-html-reporter');
const options = {
  theme: 'bootstrap',
  jsonFile: 'reports/cucumber-report.json',
  output: 'reports/cucumber-report.html',
  reportSuiteAsScenarios: true,
  launchReport: false,
  metadata: {
    "App Version": "1.0.0",
    "Test Environment": "QA",
    "Browser": "Chromium",
    "Platform": process.platform,
  },
  storeScreenshots: true,
  screenshotsDirectory: 'screenshots',
  noInlineScreenshots: false,
};

reporter.generate(options);
