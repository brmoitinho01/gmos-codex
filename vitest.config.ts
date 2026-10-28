import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      GMOS_DB_NAME: "test-suite",
      BETTER_AUTH_SECRET: "test-only-secret-with-more-than-thirty-two-characters",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
