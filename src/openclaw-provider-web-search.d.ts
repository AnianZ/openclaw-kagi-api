declare module "openclaw/plugin-sdk/provider-web-search" {
  export function getScopedCredentialValue(
    config: unknown,
    providerId: string,
  ): unknown;
  export function setScopedCredentialValue(
    target: unknown,
    providerId: string,
    value: unknown,
  ): unknown;
  export function resolveProviderWebSearchPluginConfig(
    config: unknown,
    providerId: string,
  ): { apiKey?: unknown } | undefined;
  export function setProviderWebSearchPluginConfigValue(
    target: unknown,
    providerId: string,
    key: string,
    value: unknown,
  ): unknown;
  export function mergeScopedSearchConfig(
    searchConfig: unknown,
    providerId: string,
    pluginConfig: unknown,
    options?: { mirrorApiKeyToTopLevel?: boolean },
  ): unknown;
  export function buildSearchCacheKey(parts: string[]): string;
  export function readCachedSearchPayload(
    key: string,
  ): Record<string, unknown> | null;
  export function writeCachedSearchPayload(
    key: string,
    payload: unknown,
    ttlMs: number | undefined,
  ): void;
  export function resolveSearchCount(
    requested: number | undefined,
    fallback: number,
  ): number;
  export function resolveSearchTimeoutSeconds(
    config: unknown,
  ): number | undefined;
  export function resolveSearchCacheTtlMs(config: unknown): number | undefined;
  export function resolveSiteName(url: string): string;
  export function readConfiguredSecretString(
    value: unknown,
    path: string,
  ): string | undefined;
  export function wrapWebContent(value: string, source: string): string;
  export function readStringParam(
    args: Record<string, unknown>,
    key: string,
    options?: { required?: boolean },
  ): string | undefined;
  export function readNumberParam(
    args: Record<string, unknown>,
    key: string,
    options?: { integer?: boolean },
  ): number | undefined;
  export function enablePluginInConfig(
    config: unknown,
    providerId: string,
  ): { config: any };
}
