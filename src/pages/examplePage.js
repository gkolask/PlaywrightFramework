class ExamplePage {
  constructor(page) {
    this.page = page;
    this.headingLocator = 'h1';
  }

  async open() {
    await this.page.goto('https://example.com');
  }

  async getTitle() {
    return this.page.title();
  }

  async getHeadingText() {
    return this.page.textContent(this.headingLocator);
  }

  async getParagraphText() {
    // example.com contains a single main paragraph under div > p
    return this.page.textContent('div > p') || this.page.textContent('p');
  }
}

module.exports = ExamplePage;
