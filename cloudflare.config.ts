import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "ada-the-navigator",
    compatibilityDate: "2026-11-10",
    observability: {
      enabled: true,
      logs: { enabled: true },
      traces: { enabled: true },
    },
  },
});
