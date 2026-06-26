module.exports = {
  apiKey: process.env.APPLITOOLS_API_KEY || '',
  // Optional: batch and concurrency settings
  batch: { name: 'PlaywrightFramework Batch' },
  concurrency: 5,
  // Optional: set viewport sizes for Ultrafast Grid
  viewportSize: { width: 1280, height: 720 },
};