const KAGI_SEARCH_URL = "https://kagi.com/api/v1/search";

export interface KagiApiSearchOptions {
  apiKey: string;
  query: string;
  count: number;
  timeoutMs: number;
}

export interface KagiApiSearchItem {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export type KagiApiSearchResult =
  | { ok: true; results: KagiApiSearchItem[] }
  | { ok: false; error: string; errorCode: string; detail?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

// Status meanings follow Kagi's v1 OpenAPI spec: 403 is an IP allowlist
// rejection, not a bad key, and 429 also covers exhausted usage limits.
function errorCodeForStatus(status: number): string {
  if (status === 400) return "invalid_request";
  if (status === 401) return "invalid_api_key";
  if (status === 403) return "ip_not_authorized";
  if (status === 402) return "payment_required";
  if (status === 429) return "rate_limited";
  return "api_error";
}

// Kagi's error envelope is `{ meta, error: [{ code, url, message? }] }`, and
// `message` may be null, so fall back to the namespaced code.
function errorMessage(body: unknown): string | undefined {
  const errors = asRecord(body)?.error;
  const first = asRecord(Array.isArray(errors) ? errors[0] : undefined);
  return text(first?.message) ?? text(first?.code);
}

export async function apiSearch(
  options: KagiApiSearchOptions,
): Promise<KagiApiSearchResult> {
  let response: Response;
  try {
    response = await fetch(KAGI_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "OpenClaw-Kagi-API/1.0",
      },
      body: JSON.stringify({
        query: options.query,
        workflow: "search",
        format: "json",
        limit: options.count,
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        ok: false,
        error: `Kagi Search API request timed out after ${options.timeoutMs} ms.`,
        errorCode: "timeout",
        detail: error.message,
      };
    }
    return {
      ok: false,
      error: "Kagi Search API request failed.",
      errorCode: "fetch_error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  let bodyText: string;
  try {
    bodyText = await response.text();
  } catch (error) {
    return {
      ok: false,
      error: "Kagi Search API response could not be read.",
      errorCode: "invalid_response",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  let body: unknown;
  let validJson = true;
  try {
    body = JSON.parse(bodyText);
  } catch {
    validJson = false;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `Kagi Search API returned HTTP ${response.status}.`,
      errorCode: errorCodeForStatus(response.status),
      detail: errorMessage(body) ?? bodyText.slice(0, 300),
    };
  }

  if (!validJson) {
    return {
      ok: false,
      error: `Kagi Search API returned HTTP ${response.status} with invalid JSON.`,
      errorCode: "invalid_response",
      detail: bodyText.slice(0, 300),
    };
  }

  const record = asRecord(body);
  const data = asRecord(record?.data);
  if (!Array.isArray(data?.search)) {
    return {
      ok: false,
      error: "Kagi Search API response did not contain search results.",
      errorCode: "invalid_response",
    };
  }

  const results: KagiApiSearchItem[] = [];
  for (const rawItem of data.search) {
    const item = asRecord(rawItem);
    if (!item) continue;

    const url = text(item.url);
    if (!url) continue;
    const published = text(item.time);

    results.push({
      title: text(item.title) ?? url,
      url,
      snippet: text(item.snippet) ?? "",
      ...(published ? { published } : {}),
    });
    if (results.length >= options.count) break;
  }

  return { ok: true, results };
}

