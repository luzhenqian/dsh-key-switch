/**
 * dsh-key-switch —— 宿主半边。
 *
 * 一个 `deepseek-official` 路由只能配一把 key（`PROVIDER` 是写死的单一路由），
 * 所以"多账号"只能靠换 key：本插件把每把 key 存在自己的注册表里，切换时改写
 * `$DSH_HOME/.credentials.yaml` 里该路由引用的那个凭据项，宿主会热重载，
 * 下一次模型调用就用新 key——不用重启进程。
 *
 * 为什么不走 `ctx.credentials` 服务：在这套宿主上，请求处理里 await 那个服务
 * 会让响应永远不回到浏览器（前端 fetch 一直 pending）。凭据文件格式稳定、
 * 热重载可用，直接读写文件既等价又不阻塞。
 *
 * 路由（全部同源）：
 *   GET  /plugins/dsh-key-switch/state     → { ok, providers: [...] }，只返回掩码
 *   POST /plugins/dsh-key-switch/add       ← { providerId, note, value }
 *   POST /plugins/dsh-key-switch/activate  ← { providerId, id }
 *   POST /plugins/dsh-key-switch/remove    ← { providerId, id }
 *   POST /plugins/dsh-key-switch/note      ← { providerId, id, note }
 *
 * 注册表落在 `$DSH_HOME/dsh-key-switch/keys.json`（0600）。
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = "/plugins/dsh-key-switch";
/** 发现不到 provider 时退回的默认值（DeepSeek 官方适配器的固定路由）。 */
const FALLBACK = { providerId: "deepseek-official", ns: "llm-deepseek", ref: "DEEPSEEK_API_KEY" };
const MAX_BODY_BYTES = 64 * 1024;
const MASK_KEEP = 4;
const DISCOVER_TIMEOUT_MS = 1200;
const DISCOVER_TTL_MS = 30_000;

export const name = "dsh-key-switch";
/** 只硬依赖 webServer；其余服务用 ctx.get 软取且带超时，缺了也不影响主流程。 */
export const inject = ["webServer"];

//#region 路径

/** `$DSH_HOME`，没设置时退回 `~/.dsh`。 */
function dshHome() {
	const raw = process.env.DSH_HOME;
	if (!raw) return join(homedir(), ".dsh");
	if (raw === "~") return homedir();
	if (raw.startsWith("~/")) return join(homedir(), raw.slice(2));
	return raw;
}

function storeDir() {
	return join(dshHome(), "dsh-key-switch");
}

function storePath() {
	return join(storeDir(), "keys.json");
}

function credentialsPath() {
	return join(dshHome(), ".credentials.yaml");
}

//#endregion

//#region 凭据文件读写（行级编辑，保留其余内容）

/** 解析 `refs:` 段里的 名称 → 值。 */
export function parseRefs(text) {
	const refs = {};
	let inRefs = false;
	for (const line of String(text).split(/\r?\n/)) {
		if (/^refs:\s*$/.test(line)) {
			inRefs = true;
			continue;
		}
		if (!inRefs) continue;
		if (/^\S/.test(line)) break; // 下一个顶层键
		const match = line.match(/^\s+([A-Za-z0-9_.-]+):\s*(.*)$/);
		if (!match) continue;
		refs[match[1]] = match[2].trim().replace(/^["']/, "").replace(/["']$/, "");
	}
	return refs;
}

/** 读一把凭据的当前值（读不到就是空串）。 */
export function readRef(ref) {
	try {
		return parseRefs(readFileSync(credentialsPath(), "utf8"))[ref] || "";
	} catch {
		return "";
	}
}

/** 原子写一把凭据的值；其余行原样保留。 */
export function writeRef(ref, value) {
	const path = credentialsPath();
	mkdirSync(dshHome(), { recursive: true, mode: 0o700 });
	let text = "";
	if (existsSync(path)) text = readFileSync(path, "utf8");
	if (!text.trim()) text = "version: 1\nrefs:\n";

	const lines = text.split(/\r?\n/);

	// 找到 refs 段；没有就补一个。
	let refsAt = lines.findIndex((line) => /^refs:\s*\{\s*\}\s*$/.test(line) || /^refs:\s*$/.test(line));
	if (refsAt < 0) {
		lines.unshift("refs:");
		refsAt = 0;
	} else {
		lines[refsAt] = "refs:";
	}

	let replaced = false;
	let insertAt = refsAt + 1;
	for (let i = refsAt + 1; i < lines.length; i += 1) {
		const line = lines[i];
		if (/^\S/.test(line)) break; // 进入下一个顶层键
		insertAt = i + 1;
		const match = line.match(/^(\s+)([A-Za-z0-9_.-]+):/);
		if (match && match[2] === ref) {
			lines[i] = `  ${ref}: ${value}`;
			replaced = true;
			break;
		}
	}
	if (!replaced) lines.splice(insertAt, 0, `  ${ref}: ${value}`);

	const body = lines.join("\n");
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, body, { mode: 0o600 });
	chmodSync(tmp, 0o600);
	renameSync(tmp, path);
	return true;
}

//#endregion

//#region 插件自己的密钥池

function readStore() {
	try {
		const parsed = JSON.parse(readFileSync(storePath(), "utf8"));
		if (parsed && typeof parsed === "object" && parsed.providers && typeof parsed.providers === "object") return parsed;
	} catch {
		// 首次运行 / 文件损坏
	}
	return { providers: {} };
}

function writeStore(store) {
	mkdirSync(storeDir(), { recursive: true, mode: 0o700 });
	const tmp = `${storePath()}.tmp`;
	writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
	chmodSync(tmp, 0o600);
	renameSync(tmp, storePath());
}

function providerEntry(store, providerId) {
	if (!store.providers[providerId]) store.providers[providerId] = { keys: [] };
	const entry = store.providers[providerId];
	if (!Array.isArray(entry.keys)) entry.keys = [];
	return entry;
}

//#endregion

//#region provider 发现（带超时 + 缓存，失败退回默认值）

let discoverCache = { at: 0, list: [] };

function withTimeout(promise, ms, fallback) {
	let timer;
	const settled = new Promise((resolve) => {
		timer = setTimeout(() => resolve(fallback), ms);
	});
	return Promise.race([Promise.resolve(promise).catch(() => fallback), settled]).finally(() => clearTimeout(timer));
}

async function discover(ctx) {
	if (discoverCache.list.length && Date.now() - discoverCache.at < DISCOVER_TTL_MS) return discoverCache.list;

	const fallbackList = [{ ...FALLBACK, displayName: FALLBACK.providerId }];
	const llm = ctx.get("llm");
	const settings = ctx.get("settings");
	if (llm && typeof llm.listConfigurableProviders === "function") {
		const list = await withTimeout(llm.listConfigurableProviders(), DISCOVER_TIMEOUT_MS, null);
		if (Array.isArray(list) && list.length) {
			const found = [];
			for (const entry of list) {
				let ref = "";
				try {
					let node = settings ? settings.get(entry.settingsNs) : undefined;
					const path = Array.isArray(entry.settingsPath) ? entry.settingsPath : [];
					for (const segment of path) node = node && typeof node === "object" ? node[segment] : undefined;
					if (node && typeof node === "object") ref = String(node.apiKeyEnv || node.apiKey || "");
				} catch {
					ref = "";
				}
				if (!ref) continue;
				found.push({
					providerId: String(entry.provider),
					displayName: String(entry.displayName || entry.provider),
					ns: String(entry.settingsNs || ""),
					path: Array.isArray(entry.settingsPath) ? entry.settingsPath : [],
					ref
				});
			}
			if (found.length) {
				discoverCache = { at: Date.now(), list: found };
				return found;
			}
		}
	}
	// 发现失败也别把功能弄丢：默认那条路由一定存在。
	discoverCache = { at: Date.now(), list: fallbackList };
	return fallbackList;
}

async function resolveProvider(ctx, providerId) {
	const list = await discover(ctx);
	const id = String(providerId || FALLBACK.providerId);
	return list.find((item) => item.providerId === id) || (id === FALLBACK.providerId ? { ...FALLBACK, displayName: FALLBACK.providerId } : null);
}

//#endregion

//#region HTTP 基础

/** 一行响应：显式写 content-length（chunked 在这套宿主的前端上不稳）。 */
function sendJson(response, status, value) {
	const body = JSON.stringify(value);
	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"content-length": String(Buffer.byteLength(body))
	});
	response.end(body);
}

function readJsonBody(request) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		request.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				reject(new Error("请求体过大"));
				request.destroy?.();
				return;
			}
			chunks.push(chunk);
		});
		request.on("end", () => {
			const text = Buffer.concat(chunks).toString("utf8").trim();
			if (!text) {
				resolve({});
				return;
			}
			try {
				const parsed = JSON.parse(text);
				resolve(parsed && typeof parsed === "object" ? parsed : {});
			} catch (error) {
				reject(new Error(`无法解析请求体：${error && error.message ? error.message : String(error)}`));
			}
		});
		request.on("error", reject);
	});
}

function mask(value) {
	const text = String(value || "");
	if (!text) return "";
	if (text.length <= MASK_KEEP) return "*".repeat(text.length);
	return `****${text.slice(-MASK_KEEP)}`;
}

function newKeyId() {
	return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

//#endregion

//#region 处理函数

async function handleState(ctx, response) {
	const store = readStore();
	const list = await discover(ctx);
	const providers = [];
	for (const item of list) {
		const live = readRef(item.ref);
		const entry = store.providers[item.providerId];
		const keys = (entry && Array.isArray(entry.keys) ? entry.keys : []).map((key) => ({
			id: key.id,
			note: key.note || "",
			masked: mask(key.value),
			active: Boolean(live) && key.value === live
		}));
		providers.push({
			providerId: item.providerId,
			displayName: item.displayName,
			ref: item.ref,
			liveMasked: mask(live),
			liveInPool: keys.some((key) => key.active),
			// 环境变量会盖住凭据文件；有的话在界面上说清楚。
			shadowedByEnv: Boolean(process.env[item.ref]),
			keys
		});
	}
	sendJson(response, 200, { ok: true, providers });
}

//#region 余额查询

/** 余额查询结果的缓存：同一把 key 在 TTL 内不重复打接口。 */
const balanceCache = new Map();
const BALANCE_TTL_MS = 60_000;
const BALANCE_TIMEOUT_MS = 8000;
const BALANCE_URL = "https://api.deepseek.com/user/balance";

function moneyText(value) {
	const text = value === undefined || value === null ? "" : String(value);
	return text;
}

/** 查一把 key 的余额。宿主进程发请求，不受浏览器跨域限制。 */
async function fetchBalance(cacheId, value, fresh) {
	const cached = balanceCache.get(cacheId);
	if (!fresh && cached && Date.now() - cached.at < BALANCE_TTL_MS) return cached;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), BALANCE_TIMEOUT_MS);
	try {
		const response = await fetch(BALANCE_URL, {
			headers: { authorization: `Bearer ${value}`, accept: "application/json" },
			signal: controller.signal
		});
		if (!response.ok) {
			const entry = { at: Date.now(), ok: false, error: `HTTP ${response.status}` };
			balanceCache.set(cacheId, entry);
			return entry;
		}
		const body = await response.json();
		const infos = Array.isArray(body && body.balance_infos) ? body.balance_infos : [];
		const first = infos[0] || {};
		const entry = {
			at: Date.now(),
			ok: true,
			available: body && body.is_available !== false,
			currency: moneyText(first.currency),
			total: moneyText(first.total_balance),
			granted: moneyText(first.granted_balance),
			toppedUp: moneyText(first.topped_up_balance),
			// 有的账号是多币种，全带上免得只显示第一种。
			all: infos.map((info) => ({
				currency: moneyText(info.currency),
				total: moneyText(info.total_balance),
				granted: moneyText(info.granted_balance),
				toppedUp: moneyText(info.topped_up_balance)
			}))
		};
		balanceCache.set(cacheId, entry);
		return entry;
	} catch (error) {
		const aborted = error && error.name === "AbortError";
		const entry = { at: Date.now(), ok: false, error: aborted ? "查询超时" : String((error && error.message) || error) };
		balanceCache.set(cacheId, entry);
		return entry;
	} finally {
		clearTimeout(timer);
	}
}

/** 并发查池子里每把 key（以及当前生效但不在池子里的那把）的余额。 */
async function handleBalances(ctx, response, fresh) {
	const store = readStore();
	const list = await discover(ctx);
	const jobs = [];
	const results = {};

	for (const entry of Object.values(store.providers)) {
		for (const key of entry.keys || []) {
			jobs.push(fetchBalance(key.id, key.value, fresh).then((result) => {
				results[key.id] = result;
			}));
		}
	}

	// 当前生效但没进池子的 key 也查一次，用 `live:<ref>` 作为缓存键。
	for (const item of list) {
		const live = readRef(item.ref);
		if (!live) continue;
		const pooled = Object.values(store.providers).some((entry) =>
			(entry.keys || []).some((key) => key.value === live)
		);
		if (pooled) continue;
		jobs.push(fetchBalance(`live:${item.ref}`, live, fresh).then((result) => {
			results[`live:${item.ref}`] = result;
		}));
	}

	await Promise.all(jobs);
	sendJson(response, 200, { ok: true, at: Date.now(), results });
}

//#endregion


async function handleAdd(ctx, response, payload) {
	const provider = await resolveProvider(ctx, payload.providerId);
	if (!provider) {
		sendJson(response, 200, { ok: false, error: "未知的 provider" });
		return;
	}
	const value = String(payload.value || "").trim();
	if (!value) {
		sendJson(response, 200, { ok: false, error: "密钥不能为空" });
		return;
	}
	if (/\s/.test(value)) {
		sendJson(response, 200, { ok: false, error: "密钥里不能有空白字符" });
		return;
	}
	const store = readStore();
	const entry = providerEntry(store, provider.providerId);
	if (entry.keys.some((key) => key.value === value)) {
		sendJson(response, 200, { ok: false, error: "这把密钥已经在列表里了" });
		return;
	}
	entry.ref = provider.ref;
	entry.keys.push({ id: newKeyId(), note: String(payload.note || "").trim(), value, addedAt: new Date().toISOString() });
	writeStore(store);
	sendJson(response, 200, { ok: true });
}

async function handleActivate(ctx, response, payload) {
	const provider = await resolveProvider(ctx, payload.providerId);
	if (!provider) {
		sendJson(response, 200, { ok: false, error: "未知的 provider" });
		return;
	}
	const store = readStore();
	const entry = store.providers[provider.providerId];
	const target = entry && Array.isArray(entry.keys) ? entry.keys.find((key) => key.id === payload.id) : undefined;
	if (!target) {
		sendJson(response, 200, { ok: false, error: "找不到这把密钥" });
		return;
	}
	try {
		writeRef(provider.ref, target.value);
	} catch (error) {
		sendJson(response, 200, { ok: false, error: `写入凭据文件失败：${error && error.message ? error.message : String(error)}` });
		return;
	}
	// 读回来确认真的落盘了，别只凭 writeFileSync 不抛错就报成功。
	const back = readRef(provider.ref);
	if (back !== target.value) {
		sendJson(response, 200, { ok: false, error: "写入后校验不一致：凭据文件可能被别的进程同时改过" });
		return;
	}
	entry.ref = provider.ref;
	writeStore(store);
	sendJson(response, 200, { ok: true, active: mask(target.value), ref: provider.ref, shadowedByEnv: Boolean(process.env[provider.ref]) });
}

async function handleRemove(ctx, response, payload) {
	const providerId = String(payload.providerId || FALLBACK.providerId);
	const store = readStore();
	const entry = store.providers[providerId];
	if (!entry || !Array.isArray(entry.keys)) {
		sendJson(response, 200, { ok: false, error: "这个 provider 下还没有密钥" });
		return;
	}
	const index = entry.keys.findIndex((key) => key.id === payload.id);
	if (index < 0) {
		sendJson(response, 200, { ok: false, error: "找不到这把密钥" });
		return;
	}
	entry.keys.splice(index, 1);
	writeStore(store);
	sendJson(response, 200, { ok: true });
}

async function handleNote(ctx, response, payload) {
	const providerId = String(payload.providerId || FALLBACK.providerId);
	const store = readStore();
	const entry = store.providers[providerId];
	const target = entry && Array.isArray(entry.keys) ? entry.keys.find((key) => key.id === payload.id) : undefined;
	if (!target) {
		sendJson(response, 200, { ok: false, error: "找不到这把密钥" });
		return;
	}
	target.note = String(payload.note || "").trim();
	writeStore(store);
	sendJson(response, 200, { ok: true });
}

//#endregion

export function apply(ctx) {
	const route = (path, handler) =>
		ctx.webServer.register({
			path,
			kind: "exact",
			handler: async (request, response) => {
				try {
					await handler(request, response);
				} catch (error) {
					sendJson(response, 200, { ok: false, error: String((error && error.message) || error) });
				}
			}
		});

	const disposers = [];

	disposers.push(route(`${BASE}/state`, async (request, response) => {
		if (String(request.method).toUpperCase() !== "GET") {
			sendJson(response, 405, { ok: false, error: "只支持 GET" });
			return;
		}
		await handleState(ctx, response);
	}));

	disposers.push(route(`${BASE}/balances`, async (request, response) => {
		if (String(request.method).toUpperCase() !== "GET") {
			sendJson(response, 405, { ok: false, error: "只支持 GET" });
			return;
		}
		const fresh = /[?&]fresh=1\b/.test(String(request.url || ""));
		await handleBalances(ctx, response, fresh);
	}));

	const write = (suffix, handler) =>
		disposers.push(route(`${BASE}/${suffix}`, async (request, response) => {
			if (String(request.method).toUpperCase() !== "POST") {
				sendJson(response, 405, { ok: false, error: "只支持 POST" });
				return;
			}
			// 只接受带会话 cookie 的同源调用，免得本机其它进程拿它改 key。
			const cookie = request.headers && request.headers.cookie;
			if (!cookie) {
				sendJson(response, 403, { ok: false, error: "缺少会话 cookie" });
				return;
			}
			const payload = await readJsonBody(request);
			await handler(request, response, payload);
		}));

	write("add", (request, response, payload) => handleAdd(ctx, response, payload));
	write("activate", (request, response, payload) => handleActivate(ctx, response, payload));
	write("remove", (request, response, payload) => handleRemove(ctx, response, payload));
	write("note", (request, response, payload) => handleNote(ctx, response, payload));

	return () => {
		for (const dispose of disposers) {
			try {
				dispose?.();
			} catch {
				// 关停时忽略
			}
		}
	};
}
