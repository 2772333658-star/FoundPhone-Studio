import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: [
    "runtime.spec.ts",
    "release.spec.ts",
    "launcher.spec.ts",
    "home-swipe.spec.ts",
    "app-organization.spec.ts",
    "preview.spec.ts",
    "mymy.spec.ts",
    "reference-next.spec.ts",
    "original-icons.spec.ts",
    "live-chat.spec.ts",
  ],
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? undefined
      : "chrome",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox"],
        }
      : undefined,
    headless: true,
    serviceWorkers: "block",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --config vite.runtime.config.ts --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
  },
  workers: 1,
  reporter: "list",
});
