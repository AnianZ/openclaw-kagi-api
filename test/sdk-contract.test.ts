import { describe, expect, it } from "vitest";
import * as sdk from "openclaw/plugin-sdk/provider-web-search";

// The SDK subpath ships without type declarations, so
// src/openclaw-provider-web-search.d.ts is hand-written. These checks catch
// drift between that shim and the runtime module.
describe("openclaw provider-web-search SDK contract", () => {
  it.each([
    "getScopedCredentialValue",
    "setScopedCredentialValue",
    "resolveProviderWebSearchPluginConfig",
    "setProviderWebSearchPluginConfigValue",
    "mergeScopedSearchConfig",
    "buildSearchCacheKey",
    "readCachedSearchPayload",
    "writeCachedSearchPayload",
    "resolveSearchCount",
    "resolveSearchTimeoutSeconds",
    "resolveSearchCacheTtlMs",
    "resolveSiteName",
    "readConfiguredSecretString",
    "wrapWebContent",
    "readStringParam",
    "readNumberParam",
    "enablePluginInConfig",
  ])("exports %s as a function", (name) => {
    expect(typeof (sdk as Record<string, unknown>)[name]).toBe("function");
  });

  it("throws on a missing required string param", () => {
    expect(() => sdk.readStringParam({}, "query", { required: true })).toThrow();
    expect(() =>
      sdk.readStringParam({ query: "  " }, "query", { required: true }),
    ).toThrow();
  });

  it("returns numeric timeout and cache TTL defaults", () => {
    expect(sdk.resolveSearchTimeoutSeconds({})).toBe(30);
    expect(typeof sdk.resolveSearchCacheTtlMs({})).toBe("number");
  });

  it("marks cache hits and honors the read TTL", () => {
    const key = sdk.buildSearchCacheKey(["sdk-contract", String(Date.now())]);
    sdk.writeCachedSearchPayload(key, { value: 1 }, 60_000);
    expect(sdk.readCachedSearchPayload(key, 60_000)).toEqual({
      value: 1,
      cached: true,
    });
    expect(sdk.readCachedSearchPayload(key, 0)).toBeUndefined();
  });

  it("returns a config object from enablePluginInConfig", () => {
    const result = sdk.enablePluginInConfig({}, "kagi-api");
    expect(result).toHaveProperty("config");
    expect(typeof result.enabled).toBe("boolean");
  });
});
