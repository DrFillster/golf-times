import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Default R2 incremental cache; for tee-times we don't need it,
  // but the binding is harmless and matches DDN's config.
  incrementalCache: undefined,
});