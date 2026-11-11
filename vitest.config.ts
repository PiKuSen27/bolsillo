import { defineConfig } from "vitest/config";
import { version as appVersion } from "./package.json";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  test: {
    globals: true,
    environment: "node",
  },
});
