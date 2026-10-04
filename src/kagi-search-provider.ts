import {
  getScopedCredentialValue,
  setScopedCredentialValue,
  resolveProviderWebSearchPluginConfig,
  setProviderWebSearchPluginConfigValue,
  mergeScopedSearchConfig,
  buildSearchCacheKey,
  readCachedSearchPayload,
  writeCachedSearchPayload,
  resolveSearchCount,
  resolveSearchTimeoutSeconds,
  resolveSearchCacheTtlMs,
  resolveSiteName,
  readConfiguredSecretString,
  wrapWebContent,
  readStringParam,
  readNumberParam,
  enablePluginInConfig,
} from "openclaw/plugin-sdk/provider-web-search";
import { apiSearch } from "./search/api-search.js";

const PROVIDER_ID = "kagi-api";
const CREDENTIAL_PATH =
  "plugins.entries.kagi-api.config.webSearch.apiKey";

export function createKagiWebSearchProvider() {
  return {
    id: PROVIDER_ID,
    label: "Kagi Search API",
    hint: "Privacy-focused search through Kagi's official Search API",

    credentialLabel: "Kagi API key",
    envVars: ["KAGI_API_KEY"],
    placeholder: "Kagi API key",
    signupUrl: "https://kagi.com/api/keys",
    docsUrl: "https://help.kagi.com/kagi/api/search.html",
    autoDetectOrder: 50,
    credentialPath: CREDENTIAL_PATH,
    inactiveSecretPaths: [CREDENTIAL_PATH],

    getCredentialValue: (searchConfig: unknown) =>
      getScopedCredentialValue(searchConfig, PROVIDER_ID),
    setCredentialValue: (target: unknown, value: unknown) =>
      setScopedCredentialValue(target, PROVIDER_ID, value),
    getConfiguredCredentialValue: (config: unknown) =>
      resolveProviderWebSearchPluginConfig(config, PROVIDER_ID)?.apiKey,
    setConfiguredCredentialValue: (configTarget: unknown, value: unknown) =>
      setProviderWebSearchPluginConfigValue(
        configTarget,
        PROVIDER_ID,
        "apiKey",
        value,
      ),
    applySelectionConfig: (config: unknown) =>
      enablePluginInConfig(config, PROVIDER_ID).config,

    createTool: (ctx: any) => ({
      description:
        "Search the web through Kagi's official Search API. Returns structured " +
        "results with titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
          count: {
            type: "number",
            description: "Number of results to return (1-10, default 5)",
            minimum: 1,
            maximum: 10,
          },
        },
        required: ["query"],
        additionalProperties: false,
      },

      execute: async (
        args: Record<string, unknown>,
      ): Promise<Record<string, unknown>> => {
        // Throws ToolInputError on a missing or empty query.
        const query = readStringParam(args, "query", { required: true });

        const count = resolveSearchCount(
          readNumberParam(args, "count", { integer: true }),
          5,
        );
        const searchConfig = mergeScopedSearchConfig(
          ctx.searchConfig,
          PROVIDER_ID,
          resolveProviderWebSearchPluginConfig(ctx.config, PROVIDER_ID),
          { mirrorApiKeyToTopLevel: true },
        );
        const timeoutMs = resolveSearchTimeoutSeconds(searchConfig) * 1000;
        const cacheTtlMs = resolveSearchCacheTtlMs(searchConfig);
        const apiKey =
          readConfiguredSecretString(
            getScopedCredentialValue(searchConfig, PROVIDER_ID),
            CREDENTIAL_PATH,
          ) ?? process.env.KAGI_API_KEY?.trim();

        if (!apiKey) {
          return {
            error: "missing_api_key",
            message:
              "Kagi API key is not configured. Run `openclaw configure --section web` or set KAGI_API_KEY in the Gateway environment.",
          };
        }

        const cacheKey = buildSearchCacheKey([
          PROVIDER_ID,
          query,
          String(count),
        ]);
        const cached = readCachedSearchPayload(cacheKey, cacheTtlMs);
        if (cached) return cached;

        const start = Date.now();
        const result = await apiSearch({
          apiKey,
          query,
          count,
          timeoutMs,
        });

        if (!result.ok) {
          return {
            error: result.errorCode,
            message: result.error,
            ...(result.detail ? { detail: result.detail } : {}),
          };
        }

        const payload = {
          query,
          provider: PROVIDER_ID,
          count: result.results.length,
          tookMs: Date.now() - start,
          externalContent: {
            untrusted: true,
            source: "web_search",
            provider: PROVIDER_ID,
            wrapped: true,
          },
          results: result.results.map((item) => ({
            title: wrapWebContent(item.title, "web_search"),
            url: item.url,
            description: wrapWebContent(item.snippet, "web_search"),
            published: item.published,
            siteName: resolveSiteName(item.url),
          })),
        };

        writeCachedSearchPayload(cacheKey, payload, cacheTtlMs);
        return payload;
      },
    }),
  };
}
