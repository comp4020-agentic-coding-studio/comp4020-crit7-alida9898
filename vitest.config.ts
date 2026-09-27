import { defineConfig } from "vitest/config";

// Two projects: `unit` runs pure modules with no server (fast, run it while
// building); `spec` boots the built server once and checks what ships.
// `pnpm test` builds first and runs both.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "spec",
          include: ["spec/**/*.test.ts"],
          globalSetup: ["./spec/global-setup.ts"],
        },
      },
    ],
  },
});
