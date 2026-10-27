# dsh-key-switch

English | [中文](README.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin that keeps **several DeepSeek API keys in one pool**, switches the active one in one click, and shows **each key's remaining balance**.

In dsh, `deepseek-official` is a **single provider route** with exactly one credential, so running multiple accounts means swapping the key. That is all this plugin does.

## Features

- **Sidebar balance entry** above Settings, showing the active key's balance, refreshed every 60 s
- **Click to switch**: a menu lists every pooled key with its note, masked value and balance; clicking a row activates that key for the next model call — **no restart**
- **Per-key balances** from `api.deepseek.com/user/balance`, queried by the host process, cached for 60 s, with a manual refresh, multi-currency aware (CNY / USD)
- **Management page** in Settings (`API Key 管理`): add, remove, switch, annotate
- **Balance trend**: a step chart (24h / 7d / 30d) with spent-today, daily burn and days-left; each sidebar row also carries a 24h sparkline
- **Native look**: every size and colour comes from dsh's own `--dsw-*` design tokens, so light and dark themes follow automatically

## Install

```sh
dsh plugin --profile web add dsh-key-switch
```

Restart `dsh web` once (plugin layers load at boot), then open the plugin section in Settings (labelled **API Key 管理**) and paste your keys.

## How switching works

The plugin writes the selected value into the credential entry referenced by `deepseek-official` in `$DSH_HOME/.credentials.yaml` (default `DEEPSEEK_API_KEY`). dsh hot-reloads that file, so the next model call uses the new key. Writes are atomic (temp file + rename) and are read back for verification.

If an environment variable shadows the same name, it wins over the file — the UI says so instead of silently doing nothing.

## Languages

UI text follows the dsh language setting (Settings → General → Language). Six languages ship with the plugin:

| Language | Notes |
| --- | --- |
| 简体中文 `zh` | built in |
| English `en` | built in (fallback for missing keys) |
| 繁體中文 `zh-Hant` | registered by the plugin, chain `zh-Hant → zh → en` |
| 日本語 `ja` | registered by the plugin, falls back to `en` |
| 한국어 `ko` | registered by the plugin, falls back to `en` |
| Русский `ru` | registered by the plugin, falls back to `en` |

dsh itself only ships Chinese and English chrome: under Japanese, Korean or Russian the shell falls back to English while this plugin's own text stays in the chosen language.

## Balance trend

The official platform gives you a **daily-bucketed spend report** — it answers "how much did I spend". This plugin answers a different question: **how much is left, and how long will it last**.

One sample is recorded each time a balance is fetched, drawn as a step chart, with three numbers:

| Number | Meaning |
| --- | --- |
| Spent today | first sample of today minus the last, in the account's own currency |
| Daily burn | actual spend over the last 7 days ÷ observed days (0 when nothing was spent) |
| Days left | current balance ÷ daily burn; shows — instead of inventing a number when nothing is being spent |

The line is a **step**, not a slope: a balance is a step function, and a slope would pretend money drains at a constant rate. Gaps longer than 3× the median interval break the line instead of connecting a fake segment; failed queries are recorded too, leaving a gap rather than a dive to zero.

### Where the data lives

`$DSH_HOME/dsh-key-switch/balances.jsonl`, append-only, one sample per line, mode `0600`:

```json
{"v":1,"t":1793128276356,"k":"k_mvqbpnx1_ojvu2w","c":"CNY","b":"26.43","g":"0.00","u":"26.43"}
```

Only the pool's stable key id is stored — never the key itself. Identical values are recorded at most every 5 minutes; raw points are kept for 7 days, compressed to hourly for 7–90 days, then dropped (automatic, no maintenance). Two keys for 90 days is roughly 1 MB.

### What it is not

- Not continuous monitoring: nothing is sampled while dsh isn't running, so those stretches are gaps
- Not a replacement for the official bill: the platform's daily report remains the authoritative number

## Data and security

| Item | Detail |
| --- | --- |
| Key storage | `$DSH_HOME/dsh-key-switch/keys.json`, mode `0600` (plain text — without the value there is nothing to switch) |
| What the browser sees | `****` + last 4 characters only |
| Write endpoints | Require the same-origin session cookie |
| Balance requests | Issued by the host process to `api.deepseek.com`; no third-party calls, no telemetry |

## Status

Tested on **DSH 0.1.5-rc.3** with the Web profile (macOS / Chrome). Known limits: DeepSeek official balances only; one key per provider route (a dsh constraint); multiple dsh tabs on the same origin can starve new requests through the browser's six-connection limit. The settings-nav glyph is chosen by the host from a hardcoded section-id table (third-party sections always get the gear), so the plugin swaps it for a key icon at the DOM level — if the host changes the nav structure the icon falls back to the gear and nothing else breaks.

## License

MIT
