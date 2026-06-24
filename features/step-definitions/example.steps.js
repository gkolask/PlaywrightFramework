const { Given, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');
const ExamplePage = require('../../src/pages/examplePage');

Given('I open the example domain', async function () {
  this.examplePage = new ExamplePage(this.page);
  await this.examplePage.open();
});

Then('I should see the page title {string}', async function (expectedTitle) {
  const title = await this.examplePage.getTitle();
  expect(title).to.equal(expectedTitle);
});

Then('I should see the main heading {string}', async function (expectedHeading) {
  const heading = await this.examplePage.getHeadingText();
  expect(heading.trim()).to.equal(expectedHeading);
});
