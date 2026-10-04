import { afterEach, describe, expect, it, vi } from "vitest";
import { createKagiWebSearchProvider } from "../src/kagi-search-provider.js";

const previousApiKey = process.env.KAGI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (previousApiKey === undefined) {
    delete process.env.KAGI_API_KEY;
  } else {
    process.env.KAGI_API_KEY = previousApiKey;
  }
});

describe("Kagi web-search provider", () => {
  it("declares stable provider and credential metadata", () => {
    const provider = createKagiWebSearchProvider();

    expect(provider.id).toBe("kagi-api");
    expect(provider.envVars).toEqual(["KAGI_API_KEY"]);
    expect(provider.credentialPath).toBe(
      "plugins.entries.kagi-api.config.webSearch.apiKey",
    );
    expect(provider.docsUrl).toBe(
      "https://help.kagi.com/kagi/api/search.html",
    );
  });

  it("fails clearly when no API key is configured", async () => {
    delete process.env.KAGI_API_KEY;
    const tool = createKagiWebSearchProvider().createTool({
      searchConfig: {},
      config: {},
    });

    await expect(tool.execute({ query: "test" })).resolves.toMatchObject({
      error: "missing_api_key",
    });
  });

  it("uses KAGI_API_KEY and returns wrapped web-search results", async () => {
    process.env.KAGI_API_KEY = "environment-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              search: [
                {
                  title: "OpenClaw",
                  url: "https://openclaw.ai/",
                  snippet: "An agent platform",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const tool = createKagiWebSearchProvider().createTool({
      searchConfig: { cacheTtlMinutes: 0 },
      config: {},
    });

    const result = await tool.execute({
      query: `provider-test-${Date.now()}`,
      count: 1,
    });

    expect(result).toMatchObject({
      provider: "kagi-api",
      count: 1,
      externalContent: {
        untrusted: true,
        source: "web_search",
        provider: "kagi-api",
      },
    });
    expect(result.results[0].url).toBe("https://openclaw.ai/");
  });
});

