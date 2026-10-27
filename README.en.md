# dsh-key-switch

English | [中文](README.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin that keeps **several DeepSeek API keys in one pool**, switches the active one in one click, and shows **each key's remaining balance**.

In dsh, `deepseek-official` is a **single provider route** with exactly one credential, so running multiple accounts means swapping the key. That is all this plugin does.

## Features

- **Sidebar balance entry** above Settings, showing the active key's balance, refreshed every 60 s
- **Click to switch**: a menu lists every pooled key with its note, masked value and balance; clicking a row activates that key for the next model call — **no restart**
- **Per-key balances** from `api.deepseek.com/user/balance`, queried by the host process, cached for 60 s, with a manual refresh, multi-currency aware (CNY / USD)
- **Management page** in Settings (`API Key 管理`): add, remove, switch, annotate
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

## Data and security

| Item | Detail |
| --- | --- |
| Key storage | `$DSH_HOME/dsh-key-switch/keys.json`, mode `0600` (plain text — without the value there is nothing to switch) |
| What the browser sees | `****` + last 4 characters only |
| Write endpoints | Require the same-origin session cookie |
| Balance requests | Issued by the host process to `api.deepseek.com`; no third-party calls, no telemetry |

## Status

Tested on **DSH 0.1.5-rc.3** with the Web profile (macOS / Chrome). Known limits: DeepSeek official balances only; one key per provider route (a dsh constraint); multiple dsh tabs on the same origin can starve new requests through the browser's six-connection limit.

## License

MIT
