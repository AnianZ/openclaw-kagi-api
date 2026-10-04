import { afterEach, describe, expect, it, vi } from "vitest";
import { apiSearch } from "../src/search/api-search.js";

const options = {
  apiKey: "test-key",
  query: "openclaw search",
  count: 2,
  timeoutMs: 5_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiSearch", () => {
  it("calls the current Kagi v1 Search API contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            search: [
              {
                title: "First result",
                url: "https://example.com/first",
                snippet: "First snippet",
                time: "2026-10-01T12:00:00Z",
              },
              {
                title: "Second result",
                url: "https://example.org/second",
                snippet: "Second snippet",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSearch(options);

    expect(result).toEqual({
      ok: true,
      results: [
        {
          title: "First result",
          url: "https://example.com/first",
          snippet: "First snippet",
          published: "2026-10-01T12:00:00Z",
        },
        {
          title: "Second result",
          url: "https://example.org/second",
          snippet: "Second snippet",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://kagi.com/api/v1/search");
    expect(request.method).toBe("POST");
    expect(request.headers).toMatchObject({
      Authorization: "Bearer test-key",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(request.body))).toEqual({
      query: "openclaw search",
      workflow: "search",
      format: "json",
      limit: 2,
    });
  });

  it("drops malformed entries and supplies safe text fallbacks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              search: [
                null,
                { title: "Missing URL" },
                { url: "https://example.com/no-title" },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(apiSearch(options)).resolves.toEqual({
      ok: true,
      results: [
        {
          title: "https://example.com/no-title",
          url: "https://example.com/no-title",
          snippet: "",
        },
      ],
    });
  });

  it.each([
    [401, "invalid_api_key"],
    [403, "invalid_api_key"],
    [402, "payment_required"],
    [429, "rate_limited"],
    [500, "api_error"],
  ])("maps HTTP %i to %s", async (status, errorCode) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: [{ message: "Kagi error" }] }),
          { status },
        ),
      ),
    );

    await expect(apiSearch(options)).resolves.toMatchObject({
      ok: false,
      errorCode,
      detail: "Kagi error",
    });
  });

  it("handles invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 502 })),
    );

    await expect(apiSearch(options)).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_response",
      detail: "not json",
    });
  });

  it("rejects responses without data.search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: {} }), { status: 200 }),
      ),
    );

    await expect(apiSearch(options)).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_response",
    });
  });

  it("returns a controlled error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network unavailable")),
    );

    await expect(apiSearch(options)).resolves.toEqual({
      ok: false,
      error: "Kagi Search API request failed.",
      errorCode: "fetch_error",
      detail: "network unavailable",
    });
  });
});

