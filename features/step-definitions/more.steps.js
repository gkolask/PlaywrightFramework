const { Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

Then('I should see the paragraph {string}', async function (expectedText) {
  // Reuse the page object instance created by the Given step in other defs
  const paragraph = await this.examplePage.getParagraphText();
  expect(paragraph.toLowerCase()).to.include(expectedText.toLowerCase());
});
