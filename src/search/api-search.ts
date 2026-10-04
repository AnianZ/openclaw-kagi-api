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

function errorCodeForStatus(status: number): string {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 402) return "payment_required";
  if (status === 429) return "rate_limited";
  return "api_error";
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
  try {
    body = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      error: `Kagi Search API returned HTTP ${response.status} with invalid JSON.`,
      errorCode: "invalid_response",
      detail: bodyText.slice(0, 300),
    };
  }

  if (!response.ok) {
    const record = asRecord(body);
    const errors = Array.isArray(record?.error)
      ? record.error
      : Array.isArray(record?.errors)
        ? record.errors
        : [];
    const firstError = asRecord(errors[0]);
    return {
      ok: false,
      error: `Kagi Search API returned HTTP ${response.status}.`,
      errorCode: errorCodeForStatus(response.status),
      detail: text(firstError?.message) ?? bodyText.slice(0, 300),
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

    results.push({
      title: text(item.title) ?? url,
      url,
      snippet: text(item.snippet) ?? "",
      ...(text(item.time) ? { published: text(item.time) } : {}),
    });
    if (results.length >= options.count) break;
  }

  return { ok: true, results };
}

