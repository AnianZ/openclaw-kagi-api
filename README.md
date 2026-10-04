# openclaw-kagi-api

An [OpenClaw](https://openclaw.ai) web-search provider for Kagi's official
[Search API](https://help.kagi.com/kagi/api/search.html).

This plugin uses an API key from the [Kagi API dashboard](https://kagi.com/api/keys).
Kagi API usage is billed separately according to
[Kagi's current API pricing](https://kagi.com/api/pricing).

## Install

```bash
openclaw plugins install clawhub:openclaw-kagi-api
```

## Configure

Run OpenClaw's guided web-search setup and select **Kagi Search API**:

```bash
openclaw configure --section web
```

Alternatively, set `KAGI_API_KEY` in the Gateway environment and select the
provider explicitly:

```bash
openclaw config set tools.web.search.provider kagi-api
```

The plugin also accepts an API key or SecretRef at:

```text
plugins.entries.kagi-api.config.webSearch.apiKey
```

Do not commit API keys to configuration repositories.

## Verify

```bash
openclaw plugins inspect kagi-api --runtime --json
```

The inspection result should list `kagi-api` under `webSearchProviderIds`.
Then run a web search through your OpenClaw agent.

## Supported parameters

| Parameter | Support |
| --- | --- |
| `query` | Yes |
| `count` | Yes, 1–10 |
| `country` | No |
| `language` | No |
| `freshness` | No |

## Security and privacy

- The API key is sent only to `https://kagi.com/api/v1/search`.
- Search results are marked as untrusted external content before they reach the
  agent.
- The plugin does not log or persist the API key itself.
- OpenClaw's ordinary web-search cache settings apply to returned results.

## Development

Requires Node.js 24.16+ (24.x) or 26.1+, matching OpenClaw's own engine range.
`npm pack` and `npm publish` run the build automatically through `prepack`.

```bash
npm install
npm run build
npm test
npm pack --dry-run
```

## Project history

This API-only provider was derived from the MIT-licensed
[`its-clawdia/openclaw-kagi`](https://github.com/its-clawdia/openclaw-kagi)
plugin. It uses Kagi's official paid API and intentionally does not include the
original plugin's Session-Link authentication or HTML parsing.

## License

MIT
