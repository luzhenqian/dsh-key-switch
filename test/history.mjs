/**
 * 历史数据自测：分桶、今日已花、日均消耗、预计可用天数。
 *
 * 跑法：node test/history.mjs
 * 这些是纯函数，不需要宿主或浏览器。
 */

import { bucketSamples, summarize } from "../lib/index.js";

const problems = [];
const check = (name, condition, detail) => {
	if (!condition) problems.push(`${name}${detail ? "：" + detail : ""}`);
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const now = Date.now();

// 造一条 24 小时的余额阶梯：每 30 分钟一点，从 30.00 掉到 24.00，中间夹一次失败。
const rows = [];
for (let i = 0; i < 48; i += 1) {
	const t = now - 24 * HOUR + i * 30 * MIN;
	if (i === 20) {
		rows.push({ v: 1, t, k: "k1", ok: false, e: "HTTP 429" });
		continue;
	}
	const balance = (30 - i * 0.125).toFixed(2);
	rows.push({ v: 1, t, k: "k1", c: "CNY", b: balance });
}

// 1) 分桶：24h 用 5 分钟桶，点数不应超过样本数，且时间递增
const buckets = bucketSamples(rows, "24h", now);
const series = buckets.k1 || [];
check("24h 有数据", series.length > 0);
check("时间递增", series.every((point, i) => i === 0 || series[i - 1].t <= point.t));
check("失败点标记为 ok:false", series.some((point) => point.ok === false));
check("成功点带余额", series.filter((point) => point.ok).every((point) => typeof point.v === "string"));

// 2) 范围过滤：30 天前的老样本不该出现在 24h 里
const old = [{ v: 1, t: now - 40 * 24 * HOUR, k: "k1", c: "CNY", b: "99.00" }, ...rows];
check("24h 过滤掉老样本", bucketSamples(old, "24h", now).k1.every((point) => point.t >= now - 24 * HOUR));

// 3) 空桶不出点：两个样本隔 3 小时，中间不应补点
const sparse = [
	{ v: 1, t: now - 4 * HOUR, k: "k1", c: "CNY", b: "10.00" },
	{ v: 1, t: now - 1 * HOUR, k: "k1", c: "CNY", b: "9.00" }
];
check("稀疏样本不补点", bucketSamples(sparse, "24h", now).k1.length === 2);

// 4) 汇总：今日已花 / 日均 / 剩余天数
const summary = summarize(rows, now).k1;
check("汇总有币种", summary.currency === "CNY");
check("今日已花为正", Number(summary.todaySpend) > 0, summary.todaySpend);
check("日均消耗为正", Number(summary.burnPerDay) > 0, summary.burnPerDay);
check("预计天数存在", typeof summary.daysLeft === "number" && summary.daysLeft > 0, String(summary.daysLeft));
check("样本数记账", summary.samples > 0);

// 5) 边界：只有一个样本时不该编出消耗
const single = summarize([{ v: 1, t: now - HOUR, k: "k1", c: "CNY", b: "5.00" }], now).k1;
check("单样本今日已花为 0", single.todaySpend === "0.00", single.todaySpend);
check("单样本日均 0", single.burnPerDay === "0.00", single.burnPerDay);
check("单样本无预计天数", single.daysLeft === null);

// 6) 余额没变时不该有消耗
const flat = [
	{ v: 1, t: now - 6 * HOUR, k: "k1", c: "CNY", b: "5.00" },
	{ v: 1, t: now - 1 * HOUR, k: "k1", c: "CNY", b: "5.00" }
];
const flatSummary = summarize(flat, now).k1;
check("余额不变 → 今日已花 0", flatSummary.todaySpend === "0.00", flatSummary.todaySpend);
check("余额不变 → 无预计天数", flatSummary.daysLeft === null);

// 7) 失败样本不参与汇总
const withFailures = [
	...flat,
	{ v: 1, t: now - 30 * MIN, k: "k1", ok: false, e: "HTTP 500" }
];
check("失败样本被忽略", summarize(withFailures, now).k1.balance === "5.00");

if (problems.length) {
	console.error("✗ 历史数据自测失败：");
	for (const problem of problems) console.error("  - " + problem);
	process.exit(1);
}

console.log(`✓ 历史数据自测通过（24h 分桶 ${series.length} 点，日均 ${summary.burnPerDay} CNY，预计可用 ${summary.daysLeft} 天）`);
