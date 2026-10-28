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

import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { bucketCalls, costOf, parseSessionFile, workspaceOf } from "./attribution.js";

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

//#region 余额历史（追加式 JSONL）

const HISTORY_FILE = "balances.jsonl";
/** 原始样本保留 7 天，7–90 天压成每小时一点，更早的丢掉。 */
const RAW_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const HOURLY_KEEP_MS = 90 * 24 * 60 * 60 * 1000;
/** 同值样本至少隔 5 分钟才再写一行，防止狂点刷新把文件撑爆。 */
const SAMPLE_MIN_GAP_MS = 5 * 60 * 1000;
const COMPACT_EVERY_MS = 6 * 60 * 60 * 1000;

const historyPath = () => join(storeDir(), HISTORY_FILE);
let lastCompactAt = 0;

/** 读全部样本；坏行直接跳过（崩溃时最后一行可能是半行）。 */
export function readSamples() {
	const out = [];
	let text = "";
	try {
		text = readFileSync(historyPath(), "utf8");
	} catch {
		return out;
	}
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const row = JSON.parse(trimmed);
			if (row && typeof row.t === "number" && typeof row.k === "string") out.push(row);
		} catch {
			// 半行/坏行：忽略
		}
	}
	return out;
}

function writeSamples(rows) {
	mkdirSync(storeDir(), { recursive: true, mode: 0o700 });
	const body = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
	const tmp = `${historyPath()}.tmp`;
	writeFileSync(tmp, body, { mode: 0o600 });
	chmodSync(tmp, 0o600);
	renameSync(tmp, historyPath());
}

/** 压缩：7 天内原样，7–90 天每小时留最后一点，90 天外丢弃。 */
function compact(rows, now) {
	const hourly = new Map();
	const kept = [];
	for (const row of rows) {
		const age = now - row.t;
		if (age <= RAW_KEEP_MS) {
			kept.push(row);
			continue;
		}
		if (age > HOURLY_KEEP_MS) continue;
		const bucket = `${row.k}|${Math.floor(row.t / 3600000)}`;
		const previous = hourly.get(bucket);
		if (!previous || previous.t < row.t) hourly.set(bucket, row);
	}
	const compacted = [...kept, ...hourly.values()].sort((a, b) => a.t - b.t);
	writeSamples(compacted);
	return compacted;
}

/**
 * 记一个样本。
 *
 * 只在余额真的被查过时调用（缓存未命中 / 手动刷新 / 打开弹层），不额外打接口；
 * 失败也记一行，曲线在那里断开而不是画成 0。
 */
export function recordSample(keyId, entry) {
	try {
		const rows = readSamples();
		const last = [...rows].reverse().find((row) => row.k === keyId);
		const now = Date.now();
		const sameValue = last && entry.ok && last.ok && last.c === entry.currency && last.b === entry.total;
		if (last && sameValue && now - last.t < SAMPLE_MIN_GAP_MS) return;

		const row = entry.ok
			? { v: 1, t: now, k: keyId, c: entry.currency, b: entry.total, g: entry.granted, u: entry.toppedUp }
			: { v: 1, t: now, k: keyId, ok: false, e: entry.error };
		rows.push(row);

		if (now - lastCompactAt > COMPACT_EVERY_MS) {
			lastCompactAt = now;
			compact(rows, now);
			return;
		}
		mkdirSync(storeDir(), { recursive: true, mode: 0o700 });
		appendFileSync(historyPath(), JSON.stringify(row) + "\n", { mode: 0o600 });
	} catch {
		// 采样失败绝不能影响余额查询本身
	}
}

const RANGE_BUCKET_MS = {
	"24h": 5 * 60 * 1000,
	"7d": 30 * 60 * 1000,
	"30d": 2 * 60 * 60 * 1000,
	all: 6 * 60 * 60 * 1000
};
const RANGE_SPAN_MS = {
	"24h": 24 * 60 * 60 * 1000,
	"7d": 7 * 24 * 60 * 60 * 1000,
	"30d": 30 * 24 * 60 * 60 * 1000,
	all: Number.POSITIVE_INFINITY
};

/** 按范围分桶，每桶取最后一个样本；桶里没有样本就不出点（保留断点）。 */
export function bucketSamples(rows, range, now = Date.now()) {
	const bucketMs = RANGE_BUCKET_MS[range] || RANGE_BUCKET_MS["24h"];
	const span = RANGE_SPAN_MS[range] || RANGE_SPAN_MS["24h"];
	const from = now - span;
	const byKey = new Map();
	for (const row of rows) {
		if (row.t < from) continue;
		const bucket = Math.floor(row.t / bucketMs);
		let series = byKey.get(row.k);
		if (!series) {
			series = new Map();
			byKey.set(row.k, series);
		}
		const previous = series.get(bucket);
		if (!previous || previous.t < row.t) series.set(bucket, row);
	}
	const out = {};
	for (const [keyId, series] of byKey) {
		out[keyId] = [...series.values()]
			.sort((a, b) => a.t - b.t)
			.map((row) => (row.ok === false
				? { t: row.t, ok: false, e: row.e || "" }
				: { t: row.t, v: row.b, c: row.c, ok: true }));
	}
	return out;
}

/** 今日已花、日均消耗、预计可用天数——官方按天的图给不了这三个数。 */
export function summarize(rows, now = Date.now()) {
	const midnight = new Date(now);
	midnight.setHours(0, 0, 0, 0);
	const todayStart = midnight.getTime();
	const weekStart = now - 7 * 24 * 60 * 60 * 1000;

	const byKey = new Map();
	for (const row of rows) {
		if (row.ok === false) continue;
		if (row.t < weekStart) continue;
		let series = byKey.get(row.k);
		if (!series) {
			series = [];
			byKey.set(row.k, series);
		}
		series.push(row);
	}

	const out = {};
	for (const [keyId, series] of byKey) {
		series.sort((a, b) => a.t - b.t);
		const last = series[series.length - 1];
		const today = series.filter((row) => row.t >= todayStart && row.c === last.c);
		const todaySpend = today.length > 1 ? Number(today[0].b) - Number(last.b) : 0;

		const first = series[0];
		const spanDays = (last.t - first.t) / (24 * 60 * 60 * 1000);
		const spent = Number(first.b) - Number(last.b);
		const burnPerDay = spanDays >= 0.2 && spent > 0 ? spent / spanDays : 0;
		const balance = Number(last.b);
		const daysLeft = burnPerDay > 0 ? balance / burnPerDay : null;

		out[keyId] = {
			currency: last.c || "",
			balance: last.b,
			todaySpend: todaySpend > 0 ? todaySpend.toFixed(2) : "0.00",
			burnPerDay: burnPerDay > 0 ? burnPerDay.toFixed(2) : "0.00",
			daysLeft: daysLeft === null ? null : Number(daysLeft.toFixed(1)),
			samples: series.length,
			since: first.t
		};
	}
	return out;
}

async function handleHistory(ctx, response, range) {
	const rows = readSamples();
	sendJson(response, 200, {
		ok: true,
		range,
		at: Date.now(),
		series: bucketSamples(rows, range),
		summary: summarize(rows),
		samples: rows.length
	});
}

//#endregion

//#region 自动策略（阈值切换 / 权重均衡）

const POLICY_FILE = "policy.json";
const POLICY_DEFAULT = {
	v: 1,
	autoSwitch: {
		enabled: false,
		/** 按币种给阈值；没有对应币种时用 default。 */
		threshold: { default: 10 }
	},
	balance: {
		enabled: false,
		/** 每把 key 的期望消耗权重，缺省 1（等额）。 */
		weights: {},
		/** 消耗占比差超过这个百分点才动手，避免来回抖。 */
		tolerancePercent: 20,
		windowDays: 7
	},
	/** 运行状态：冷却与最近一次动作，用于展示和防抖。 */
	state: { lastSwitchAt: 0, lastReason: "", lastFrom: "", lastTo: "" },
	cooldownMinutes: 30
};

const policyPath = () => join(storeDir(), POLICY_FILE);

/** 读策略；缺字段用默认值补齐（便于以后加字段）。 */
export function readPolicy() {
	let raw = {};
	try {
		raw = JSON.parse(readFileSync(policyPath(), "utf8")) || {};
	} catch {
		raw = {};
	}
	return {
		v: 1,
		autoSwitch: { ...POLICY_DEFAULT.autoSwitch, ...(raw.autoSwitch || {}) },
		balance: { ...POLICY_DEFAULT.balance, ...(raw.balance || {}) },
		state: { ...POLICY_DEFAULT.state, ...(raw.state || {}) },
		cooldownMinutes: typeof raw.cooldownMinutes === "number" ? raw.cooldownMinutes : POLICY_DEFAULT.cooldownMinutes
	};
}

export function writePolicy(policy) {
	mkdirSync(storeDir(), { recursive: true, mode: 0o700 });
	const tmp = `${policyPath()}.tmp`;
	writeFileSync(tmp, JSON.stringify(policy, null, 2), { mode: 0o600 });
	chmodSync(tmp, 0o600);
	renameSync(tmp, policyPath());
}

/** 每把 key 在窗口内的消耗：首尾余额差（只取成功的同币种样本）。 */
export function spendInWindow(rows, keyId, windowMs, now = Date.now()) {
	const series = rows
		.filter((row) => row.k === keyId && row.ok !== false && row.t >= now - windowMs)
		.sort((a, b) => a.t - b.t);
	if (series.length < 2) return null;
	const first = series[0];
	const last = series[series.length - 1];
	if (first.c !== last.c) return null;
	const spent = Number(first.b) - Number(last.b);
	return { currency: last.c, spent: spent > 0 ? spent : 0, points: series.length };
}

/**
 * 纯决策：给定策略、池子、当前生效 key、各 key 的余额与消耗，返回该做的动作。
 *
 * 只在数据够用时才建议切换——余额读不到、没有候选、消耗全是 0 都返回 null，
 * 宁可不动也不乱换。
 */
export function decideAction(input) {
	const { policy, pool, liveValue, balances, spends, now } = input;
	if (!policy || !pool || !pool.length) return null;

	const active = pool.find((key) => key.value === liveValue);
	if (!active) return null;

	const balanceOf = (id) => balances[id];
	const activeBalance = balanceOf(active.id);

	// 1) 阈值切换：当前余额见底时换到同币种里余额最健康的一把。
	if (policy.autoSwitch && policy.autoSwitch.enabled) {
		if (!activeBalance || !activeBalance.ok) return null;
		const currency = activeBalance.currency || "";
		const thresholds = policy.autoSwitch.threshold || {};
		const threshold = Number(
			currency in thresholds ? thresholds[currency] : (thresholds.default ?? 10)
		);
		if (Number(activeBalance.total) <= threshold) {
			const candidates = pool
				.filter((key) => key.id !== active.id)
				.map((key) => ({ key, balance: balanceOf(key.id) }))
				.filter((entry) => entry.balance && entry.balance.ok
					&& (entry.balance.currency || "") === currency
					&& Number(entry.balance.total) > threshold)
				.sort((a, b) => Number(b.balance.total) - Number(a.balance.total));
			if (!candidates.length) return null;
			return {
				reason: "threshold",
				to: candidates[0].key.id,
				detail: { from: activeBalance.total, threshold, currency }
			};
		}
	}

	// 2) 权重均衡：比较"各自账户被消耗掉的比例"，避免跨币种换算。
	if (policy.balance && policy.balance.enabled) {
		const weights = policy.balance.weights || {};
		const tolerance = Number(policy.balance.tolerancePercent ?? 20) / 100;
		const scores = [];
		for (const key of pool) {
			const balance = balanceOf(key.id);
			const spend = spends[key.id];
			if (!balance || !balance.ok || !spend) continue;
			const total = Number(balance.total) + Number(spend.spent);
			if (!(total > 0)) continue;
			const depletion = Number(spend.spent) / total;
			const weight = Number(weights[key.id] ?? 1) > 0 ? Number(weights[key.id] ?? 1) : 1;
			scores.push({ id: key.id, depletion, weight, score: depletion / weight });
		}
		if (scores.length < 2) return null;
		const activeScore = scores.find((entry) => entry.id === active.id);
		if (!activeScore) return null;
		// 窗口内没有任何消耗时不评价：没花钱就不该换。
		if (scores.every((entry) => entry.depletion <= 0)) return null;
		const best = scores
			.filter((entry) => entry.id !== active.id && entry.depletion < activeScore.depletion)
			.sort((a, b) => a.score - b.score)[0];
		if (!best) return null;
		if (activeScore.score - best.score <= tolerance) return null;
		return {
			reason: "balance",
			to: best.id,
			detail: { fromScore: Number(activeScore.score.toFixed(4)), toScore: Number(best.score.toFixed(4)) }
		};
	}

	return null;
}

/** 冷却检查：刚刚切过就先不动，避免两条规则互相打架导致抖动。 */
export function withinCooldown(policy, now = Date.now()) {
	const minutes = Number(policy.cooldownMinutes ?? 30);
	if (!(minutes > 0)) return false;
	const last = Number(policy.state && policy.state.lastSwitchAt) || 0;
	return now - last < minutes * 60 * 1000;
}

async function handlePolicyGet(ctx, response) {
	sendJson(response, 200, { ok: true, policy: readPolicy() });
}

async function handlePolicySet(ctx, response, payload) {
	const current = readPolicy();
	const next = {
		...current,
		autoSwitch: { ...current.autoSwitch, ...(payload.autoSwitch || {}) },
		balance: { ...current.balance, ...(payload.balance || {}) },
		cooldownMinutes: typeof payload.cooldownMinutes === "number" ? payload.cooldownMinutes : current.cooldownMinutes
	};
	if (next.autoSwitch.threshold && typeof next.autoSwitch.threshold !== "object") {
		next.autoSwitch.threshold = { default: Number(next.autoSwitch.threshold) };
	}
	writePolicy(next);
	sendJson(response, 200, { ok: true, policy: next });
}

/**
 * 在每次拿到新余额后评估策略；真的切了就改写凭据并记下状态。
 * 返回 { switched, to, reason } 或 null，供前端提示。
 */
export async function evaluateAndApply(ctx, { ref, balances: balancesById, pool, liveValue }) {
	const policy = readPolicy();
	if (!policy.autoSwitch.enabled && !policy.balance.enabled) return null;
	const now = Date.now();
	if (withinCooldown(policy, now)) return null;

	const rows = readSamples();
	const windowMs = Number(policy.balance.windowDays ?? 7) * 24 * 60 * 60 * 1000;
	const spends = {};
	for (const key of pool) spends[key.id] = spendInWindow(rows, key.id, windowMs, now);

	const action = decideAction({ policy, pool, liveValue, balances: balancesById, spends, now });
	if (!action) return null;

	const target = pool.find((key) => key.id === action.to);
	if (!target) return null;
	try {
		writeRef(ref || FALLBACK.ref, target.value);
	} catch {
		return null;
	}

	const nextPolicy = readPolicy();
	nextPolicy.state = {
		lastSwitchAt: now,
		lastReason: action.reason,
		lastFrom: liveValue ? mask(liveValue) : "",
		lastTo: mask(target.value)
	};
	writePolicy(nextPolicy);
	return { switched: true, to: target.id, reason: action.reason, detail: action.detail };
}

//#endregion


//#region 会话消耗归因

const PRICES_FILE = "prices.json";
const SESSION_FILE_RE = /^session\..*\.jsonl\.zstd$/;
/** 文件级缓存：mtime+size 变了才重新解压解析（日志会一直追加）。 */
const sessionCache = new Map();

function sessionsRoot() {
	return join(dshHome(), "sessions");
}

/** 递归找出所有会话日志文件。 */
function listSessionFiles(dir, out = []) {
	let names = [];
	try {
		names = readdirSync(dir);
	} catch {
		return out;
	}
	for (const name of names) {
		const full = join(dir, name);
		let info;
		try {
			info = statSync(full);
		} catch {
			continue;
		}
		if (info.isDirectory()) listSessionFiles(full, out);
		else if (SESSION_FILE_RE.test(name)) out.push(full);
	}
	return out;
}

/** 解析全部会话（带缓存）；返回 { id, workspace, title, calls }。 */
export function loadSessions() {
	const sessions = [];
	for (const file of listSessionFiles(sessionsRoot())) {
		let info;
		try {
			info = statSync(file);
		} catch {
			continue;
		}
		const cached = sessionCache.get(file);
		if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
			sessions.push(cached.parsed);
			continue;
		}
		let parsed;
		try {
			parsed = parseSessionFile(readFileSync(file), "");
		} catch {
			continue;
		}
		const value = {
			id: parsed.id,
			workspace: workspaceOf(parsed.cwd),
			title: parsed.title || parsed.id,
			calls: parsed.calls
		};
		sessionCache.set(file, { mtimeMs: info.mtimeMs, size: info.size, parsed: value });
		sessions.push(value);
	}
	return sessions;
}

function readPrices() {
	try {
		const parsed = JSON.parse(readFileSync(join(storeDir(), PRICES_FILE), "utf8"));
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function writePrices(prices) {
	mkdirSync(storeDir(), { recursive: true, mode: 0o700 });
	const tmp = join(storeDir(), `${PRICES_FILE}.tmp`);
	writeFileSync(tmp, JSON.stringify(prices, null, 2), { mode: 0o600 });
	chmodSync(tmp, 0o600);
	renameSync(tmp, join(storeDir(), PRICES_FILE));
}

const RANGE_MS = {
	today: 0,
	"7d": 7 * 24 * 60 * 60 * 1000,
	"30d": 30 * 24 * 60 * 60 * 1000
};

/** 归因：会话 × 时段（默认 8 小时一段），带 token 与（有价目时的）金额。 */
export function attributionReport(sessions, { range = "today", segmentHours = 8, now = Date.now(), prices = {}, group = "session" } = {}) {
	let from = now - (RANGE_MS[range] || 0);
	if (range === "today") {
		const midnight = new Date(now);
		midnight.setHours(0, 0, 0, 0);
		from = midnight.getTime();
	}
	const segments = Math.max(1, Math.round(24 / segmentHours));
	const rows = [];
	const models = new Set();
	const totals = { input: 0, cacheRead: 0, output: 0, cost: 0, priced: false, sessions: 0, calls: 0 };

	for (const session of sessions) {
		const buckets = bucketCalls(session.calls, { segmentHours, from });
		if (!buckets.length) continue;
		const rowId = group === "model" ? "" : group === "workspace" ? (session.workspace || "—") : session.id;
		let row = group === "model" ? null : rows.find((item) => item.id === rowId);
		if (group === "model") {
			// 模型维度：每个模型一行，按需创建
			const allModels = new Set(buckets.map((bucket) => bucket.model));
			for (const model of allModels) {
				let target = rows.find((item) => item.id === model);
				if (!target) {
					target = {
						id: model,
						workspace: "",
						title: model,
						input: 0, cacheRead: 0, output: 0, calls: 0,
						cost: 0, priced: false,
						segments: Array.from({ length: segments }, () => ({ input: 0, cacheRead: 0, output: 0, cost: 0 }))
					};
					rows.push(target);
				}
			}
		}
		if (!row && group !== "model") {
			row = {
				id: rowId,
				workspace: session.workspace,
				title: group === "workspace" ? (session.workspace || "—") : session.title,
				input: 0, cacheRead: 0, output: 0, calls: 0,
				cost: 0, priced: false,
				segments: Array.from({ length: segments }, () => ({ input: 0, cacheRead: 0, output: 0, cost: 0 }))
			};
			rows.push(row);
		}
		for (const bucket of buckets) {
			if (group === "model") row = rows.find((item) => item.id === bucket.model) || row;
			models.add(bucket.model);
			row.input += bucket.input;
			row.cacheRead += bucket.cacheRead;
			row.output += bucket.output;
			row.calls += bucket.calls;
			const cell = row.segments[bucket.seg] || row.segments[segments - 1];
			cell.input += bucket.input;
			cell.cacheRead += bucket.cacheRead;
			cell.output += bucket.output;
			const cost = costOf(bucket, prices);
			if (cost !== null) {
				row.priced = true;
				row.cost += cost;
				cell.cost += cost;
			}
		}
		totals.input += row.input;
		totals.cacheRead += row.cacheRead;
		totals.output += row.output;
		totals.calls += row.calls;
		if (row.priced) {
			totals.priced = true;
			totals.cost += row.cost;
		}
		totals.sessions += 1;
	}

	rows.sort((a, b) => b.cost - a.cost || (b.input + b.output) - (a.input + a.output));
	return { from, segments, segmentHours, rows, totals, models: [...models].sort() };
}

async function handleAttribution(ctx, response, range, group) {
	const sessions = loadSessions();
	const report = attributionReport(sessions, { range, segmentHours: 8, prices: readPrices(), group });
	sendJson(response, 200, { ok: true, range, group, ...report });
}

async function handlePricesGet(ctx, response) {
	sendJson(response, 200, { ok: true, prices: readPrices() });
}

async function handlePricesSet(ctx, response, payload) {
	const next = payload && payload.prices && typeof payload.prices === "object" ? payload.prices : {};
	writePrices(next);
	sendJson(response, 200, { ok: true, prices: next });
}

//#endregion

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
		recordSample(cacheId, entry);
		return entry;
	} catch (error) {
		const aborted = error && error.name === "AbortError";
		const entry = { at: Date.now(), ok: false, error: aborted ? "查询超时" : String((error && error.message) || error) };
		balanceCache.set(cacheId, entry);
		recordSample(cacheId, entry);
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

	// 拿到新余额后评估自动策略；真的切了就把动作回给前端提示。
	let action = null;
	try {
		const pool = [];
		for (const entry of Object.values(store.providers)) {
			for (const key of entry.keys || []) pool.push({ id: key.id, value: key.value });
		}
		const ref = list[0] ? list[0].ref : FALLBACK.ref;
		const liveValue = readRef(ref);
		const balancesById = {};
		for (const key of pool) if (results[key.id]) balancesById[key.id] = results[key.id];
		if (pool.length && balancesById && Object.keys(balancesById).length) {
			action = await evaluateAndApply(ctx, { ref, balances: balancesById, pool, liveValue });
		}
	} catch {
		action = null;
	}

	sendJson(response, 200, { ok: true, at: Date.now(), results, action });
}

//#endregion


async function handleAdd(ctx, response, payload) {
	const provider = await resolveProvider(ctx, payload.providerId);
	if (!provider) {
		sendJson(response, 200, { ok: false, code: "unknown-provider", error: "未知的 provider" });
		return;
	}
	const value = String(payload.value || "").trim();
	if (!value) {
		sendJson(response, 200, { ok: false, code: "empty-key", error: "密钥不能为空" });
		return;
	}
	if (/\s/.test(value)) {
		sendJson(response, 200, { ok: false, code: "whitespace", error: "密钥里不能有空白字符" });
		return;
	}
	const store = readStore();
	const entry = providerEntry(store, provider.providerId);
	if (entry.keys.some((key) => key.value === value)) {
		sendJson(response, 200, { ok: false, code: "duplicate", error: "这把密钥已经在列表里了" });
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
		sendJson(response, 200, { ok: false, code: "unknown-provider", error: "未知的 provider" });
		return;
	}
	const store = readStore();
	const entry = store.providers[provider.providerId];
	const target = entry && Array.isArray(entry.keys) ? entry.keys.find((key) => key.id === payload.id) : undefined;
	if (!target) {
		sendJson(response, 200, { ok: false, code: "not-found", error: "找不到这把密钥" });
		return;
	}
	try {
		writeRef(provider.ref, target.value);
	} catch (error) {
		sendJson(response, 200, { ok: false, code: "write-failed", error: `写入凭据文件失败：${error && error.message ? error.message : String(error)}` });
		return;
	}
	// 读回来确认真的落盘了，别只凭 writeFileSync 不抛错就报成功。
	const back = readRef(provider.ref);
	if (back !== target.value) {
		sendJson(response, 200, { ok: false, code: "verify-mismatch", error: "写入后校验不一致：凭据文件可能被别的进程同时改过" });
		return;
	}
	entry.ref = provider.ref;
	writeStore(store);
	sendJson(response, 200, { ok: true, active: mask(target.value), ref: provider.ref, shadowedByEnv: Boolean(process.env[provider.ref]) });
}

/**
 * 返回一把 key 的明文——只为「复制」和「显示」这两件事。
 *
 * 这是整个插件唯一把明文送进浏览器的出口：POST + 同源 cookie + 只能取池子里的
 * key，取不到就报错。界面上 30 秒后自动收回显示。
 */
async function handleReveal(ctx, response, payload) {
	const provider = await resolveProvider(ctx, payload.providerId);
	if (!provider) {
		sendJson(response, 200, { ok: false, code: "unknown-provider", error: "未知的 provider" });
		return;
	}
	const store = readStore();
	const entry = store.providers[provider.providerId];
	const target = entry && Array.isArray(entry.keys) ? entry.keys.find((key) => key.id === payload.id) : undefined;
	if (!target) {
		sendJson(response, 200, { ok: false, code: "not-found", error: "找不到这把密钥" });
		return;
	}
	sendJson(response, 200, { ok: true, value: target.value, ref: provider.ref });
}

async function handleRemove(ctx, response, payload) {
	const providerId = String(payload.providerId || FALLBACK.providerId);
	const store = readStore();
	const entry = store.providers[providerId];
	if (!entry || !Array.isArray(entry.keys)) {
		sendJson(response, 200, { ok: false, code: "no-keys", error: "这个 provider 下还没有密钥" });
		return;
	}
	const index = entry.keys.findIndex((key) => key.id === payload.id);
	if (index < 0) {
		sendJson(response, 200, { ok: false, code: "not-found", error: "找不到这把密钥" });
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
		sendJson(response, 200, { ok: false, code: "not-found", error: "找不到这把密钥" });
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

	disposers.push(route(`${BASE}/policy`, async (request, response) => {
		const method = String(request.method).toUpperCase();
		if (method === "GET") {
			await handlePolicyGet(ctx, response);
			return;
		}
		if (method !== "POST") {
			sendJson(response, 405, { ok: false, error: "只支持 GET / POST" });
			return;
		}
		const cookie = request.headers && request.headers.cookie;
		if (!cookie) {
			sendJson(response, 403, { ok: false, error: "缺少会话 cookie" });
			return;
		}
		const payload = await readJsonBody(request);
		await handlePolicySet(ctx, response, payload);
	}));

	disposers.push(route(`${BASE}/attribution`, async (request, response) => {
		if (String(request.method).toUpperCase() !== "GET") {
			sendJson(response, 405, { ok: false, error: "只支持 GET" });
			return;
		}
		const url = String(request.url || "");
		const rangeMatch = /[?&]range=(today|7d|30d)\b/.exec(url);
		const groupMatch = /[?&]group=(session|workspace|model)\b/.exec(url);
		await handleAttribution(ctx, response, rangeMatch ? rangeMatch[1] : "today", groupMatch ? groupMatch[1] : "session");
	}));

	disposers.push(route(`${BASE}/prices`, async (request, response) => {
		const method = String(request.method).toUpperCase();
		if (method === "GET") {
			await handlePricesGet(ctx, response);
			return;
		}
		if (method !== "POST") {
			sendJson(response, 405, { ok: false, error: "只支持 GET / POST" });
			return;
		}
		const cookie = request.headers && request.headers.cookie;
		if (!cookie) {
			sendJson(response, 403, { ok: false, error: "缺少会话 cookie" });
			return;
		}
		await handlePricesSet(ctx, response, await readJsonBody(request));
	}));

	disposers.push(route(`${BASE}/history`, async (request, response) => {
		if (String(request.method).toUpperCase() !== "GET") {
			sendJson(response, 405, { ok: false, error: "只支持 GET" });
			return;
		}
		const match = /[?&]range=(24h|7d|30d|all)\b/.exec(String(request.url || ""));
		await handleHistory(ctx, response, match ? match[1] : "24h");
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
	write("reveal", (request, response, payload) => handleReveal(ctx, response, payload));

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
