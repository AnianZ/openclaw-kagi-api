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
    [400, "invalid_request"],
    [401, "invalid_api_key"],
    [403, "ip_not_authorized"],
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

  it("handles invalid JSON on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 200 })),
    );

    await expect(apiSearch(options)).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_response",
      detail: "not json",
    });
  });

  it.each([
    [429, "Too Many Requests", "rate_limited"],
    [401, "<html>Unauthorized</html>", "invalid_api_key"],
    [502, "Bad Gateway", "api_error"],
  ])(
    "maps a non-JSON HTTP %i body by status",
    async (status, body, errorCode) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(body, { status })),
      );

      await expect(apiSearch(options)).resolves.toMatchObject({
        ok: false,
        errorCode,
        detail: body,
      });
    },
  );

  it.each([
    [
      "the message",
      { code: "auth.invalid_token", url: "", message: "Token is invalid" },
      "Token is invalid",
    ],
    [
      "the code when message is null",
      { code: "auth.invalid_token", url: "", message: null },
      "auth.invalid_token",
    ],
  ])("uses %s from Kagi's error envelope", async (_label, error, detail) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ meta: { trace: "t" }, data: null, error: [error] }),
          { status: 401 },
        ),
      ),
    );

    await expect(apiSearch(options)).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_api_key",
      detail,
    });
  });

  it("reports timeouts separately from other fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new DOMException(
            "The operation was aborted due to timeout",
            "TimeoutError",
          ),
        ),
    );

    await expect(apiSearch(options)).resolves.toMatchObject({
      ok: false,
      errorCode: "timeout",
      error: "Kagi Search API request timed out after 5000 ms.",
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

