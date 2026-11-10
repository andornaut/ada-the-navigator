import { defineConfig } from "cf/config";

export default defineConfig({
  accountId: "90f23a78b62eb9571a3fd6c296d15f30",
  worker: {
    name: "ada-the-navigator",
    compatibilityDate: "2026-11-10",
    domains: ["navigator.adabekele.com"],
    workersDev: false,
    previewUrls: false,
    observability: {
      enabled: true,
      logs: { enabled: true },
      traces: { enabled: true },
    },
  },
});
