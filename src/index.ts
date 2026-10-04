import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createKagiWebSearchProvider } from "./kagi-search-provider.js";

export default definePluginEntry({
  id: "kagi-api",
  name: "Kagi Search API",
  description: "Kagi Search API provider for OpenClaw",
  register(api) {
    api.registerWebSearchProvider(createKagiWebSearchProvider());
  },
});

