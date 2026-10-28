/**
 * 会话日志解析与归因聚合。
 *
 * dsh 的会话文件是 `session.<version>.jsonl.zstd`：**多个 zstd 帧首尾相接**的
 * 追加式日志（一次写入一帧），Node 的解压 API 只认第一帧，所以这里按魔数扫描
 * 逐个解压，坏帧跳过。
 *
 * 每条带用量的记录长这样（`assistant/message`）：
 *   { type, seq, time, data: { turn, step, message, usage: {
 *       inputTokens, outputTokens, totalTokens, cacheReadTokens, reasoningTokens } } }
 *
 * `inputTokens` 是缓存未命中的输入，`cacheReadTokens` 是命中部分，
 * totalTokens ≈ input + cacheRead + output。模型名来自同会话的 `request/header`
 * （`data.header.config.model`）或 `request/context`，按 seq 顺序向下继承。
 */

import { zstdDecompressSync } from "node:zlib";

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

/** 把多帧 zstd 缓冲解成完整文本；无法解压的偏移直接跳过。 */
export function decodeZstdFrames(buffer) {
	const offsets = [];
	for (let i = 0; i + 3 < buffer.length; i += 1) {
		if (buffer[i] === ZSTD_MAGIC[0] && buffer[i + 1] === ZSTD_MAGIC[1]
			&& buffer[i + 2] === ZSTD_MAGIC[2] && buffer[i + 3] === ZSTD_MAGIC[3]) {
			offsets.push(i);
		}
	}
	if (!offsets.length) return "";
	let text = "";
	for (const offset of offsets) {
		try {
			text += zstdDecompressSync(buffer.subarray(offset)).toString("utf8");
		} catch {
			// 压缩数据里偶然出现的假魔数
		}
	}
	return text;
}

/**
 * 解析一个会话文件。
 *
 * @returns {{ id, cwd, title, calls: Array<{t, model, input, cacheRead, output, reasoning}> }}
 *   calls 里每次调用一条，单位是 token。
 */
export function parseSessionFile(buffer, fallbackId = "") {
	const text = decodeZstdFrames(buffer);
	if (!text) return { id: fallbackId, cwd: "", title: "", calls: [] };

	const rows = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const row = JSON.parse(trimmed);
			if (row && typeof row === "object") rows.push(row);
		} catch {
			// 半行：跳过
		}
	}
	rows.sort((a, b) => (a.seq || 0) - (b.seq || 0));

	let id = fallbackId;
	let cwd = "";
	let title = "";
	let model = "";
	const calls = [];

	for (const row of rows) {
		if (row.type === "session") {
			if (row.id) id = String(row.id);
			if (row.cwd) cwd = String(row.cwd);
			continue;
		}
		if (row.type === "session/title" && row.data && row.data.title) {
			title = String(row.data.title);
			continue;
		}
		if (row.type === "request/header") {
			const config = row.data && row.data.header && row.data.header.config;
			if (config && config.model) model = String(config.model);
			continue;
		}
		if (row.type === "request/context") {
			if (row.data && row.data.model) model = String(row.data.model);
			continue;
		}
		if (row.type === "assistant/message" && row.data && row.data.usage) {
			const usage = row.data.usage;
			const input = Number(usage.inputTokens) || 0;
			const cacheRead = Number(usage.cacheReadTokens) || 0;
			const output = Number(usage.outputTokens) || 0;
			const reasoning = Number(usage.reasoningTokens) || 0;
			if (!input && !cacheRead && !output) continue;
			calls.push({
				t: Number(row.time) || 0,
				model: model || "unknown",
				input,
				cacheRead,
				output,
				reasoning
			});
		}
	}

	return { id, cwd, title, calls };
}

/** 会话所属工作区名：取 cwd 的最后一段。 */
export function workspaceOf(cwd) {
	if (!cwd) return "";
	const parts = String(cwd).split(/[\\/]+/).filter(Boolean);
	return parts.length ? parts[parts.length - 1] : "";
}

/** 当天第几个 8 小时段（0/1/2）。 */
export function segmentOf(t, segmentHours) {
	const date = new Date(t);
	const hour = date.getHours();
	return Math.floor(hour / segmentHours);
}

/**
 * 按「会话 × 天 × 时段 × 模型」聚合。
 *
 * @param calls - parseSessionFile 出来的调用数组
 * @param options - { segmentHours = 8, from = 0 }
 * @returns 每个桶 { day, seg, model, input, cacheRead, output, reasoning, calls }
 */
export function bucketCalls(calls, options = {}) {
	const segmentHours = Number(options.segmentHours) || 8;
	const from = Number(options.from) || 0;
	const buckets = new Map();
	for (const call of calls) {
		if (!call.t || call.t < from) continue;
		const date = new Date(call.t);
		const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		const seg = segmentOf(call.t, segmentHours);
		const peak = isPeak(call.t);
		const key = `${day}|${seg}|${call.model}|${peak ? "peak" : "off"}`;
		let bucket = buckets.get(key);
		if (!bucket) {
			bucket = { day, seg, model: call.model, peak, input: 0, cacheRead: 0, output: 0, reasoning: 0, calls: 0 };
			buckets.set(key, bucket);
		}
		bucket.input += call.input;
		bucket.cacheRead += call.cacheRead;
		bucket.output += call.output;
		bucket.reasoning += call.reasoning;
		bucket.calls += 1;
	}
	return [...buckets.values()].sort((a, b) => (a.day === b.day ? a.seg - b.seg : a.day < b.day ? -1 : 1));
}

/**
 * 计价：价表由用户提供，单位「元 / 百万 token」。
 *
 *   prices[model] = { peak: { in, hit, out }, offpeak: { in, hit, out } }
 *
 * 没有该模型价目时返回 null——界面宁可显示 token，也不编一个金额。
 */
export function costOf(bucket, prices) {
	const entry = prices && prices[bucket.model];
	if (!entry) return null;
	const rate = bucket.peak ? entry.peak : entry.offpeak;
	if (!rate) return null;
	const inRate = Number(rate.in);
	const hitRate = Number(rate.hit);
	const outRate = Number(rate.out);
	if (!Number.isFinite(inRate) || !Number.isFinite(hitRate) || !Number.isFinite(outRate)) return null;
	return (bucket.input * inRate + bucket.cacheRead * hitRate + bucket.output * outRate) / 1e6;
}

/** 某时刻是否处于官方高峰时段（北京时间周一至周五 9:00-12:00、14:00-18:00）。 */
export function isPeak(t) {
	const beijing = new Date(t + 8 * 3600 * 1000);
	const weekday = beijing.getUTCDay();
	if (weekday === 0 || weekday === 6) return false;
	const hour = beijing.getUTCHours() + beijing.getUTCMinutes() / 60;
	return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
}
