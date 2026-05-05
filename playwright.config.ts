import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 300000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15000,
    launchOptions: {
      args: ['--enable-precise-memory-info'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  reporter: [
    ['json', { outputFile: 'test-output/results.json' }],
    ['html', { outputFolder: 'test-output/html', open: 'never' }],
  ],
})
