/**
 * 自动策略自测：阈值切换、权重均衡、冷却、以及各种"不该动"的情况。
 *
 * 跑法：node test/policy.mjs
 * decideAction 是纯函数，不需要宿主、文件或网络。
 */

import { decideAction, withinCooldown, spendInWindow } from "../lib/index.js";

const problems = [];
const check = (name, condition, detail) => {
	if (!condition) problems.push(`${name}${detail ? "：" + detail : ""}`);
};

const now = Date.now();
const policy = (patch = {}) => ({
	v: 1,
	autoSwitch: { enabled: true, threshold: { default: 10, USD: 10, CNY: 5 }, ...(patch.autoSwitch || {}) },
	balance: { enabled: false, weights: {}, tolerancePercent: 20, windowDays: 7, ...(patch.balance || {}) },
	state: { lastSwitchAt: 0, lastReason: "", lastFrom: "", lastTo: "" },
	cooldownMinutes: 30,
	...patch
});

const pool = [
	{ id: "k1", value: "sk-aaa" },
	{ id: "k2", value: "sk-bbb" }
];
const balances = (a, b) => ({
	k1: { ok: true, currency: "USD", total: String(a) },
	k2: { ok: true, currency: "USD", total: String(b) }
});

// 1) 阈值：当前低于阈值、另一把健康 → 切换
let action = decideAction({
	policy: policy(),
	pool,
	liveValue: "sk-aaa",
	balances: balances(3, 40),
	spends: {},
	now
});
check("低于阈值触发切换", action && action.reason === "threshold" && action.to === "k2", JSON.stringify(action));

// 2) 阈值：当前健康 → 不动
action = decideAction({ policy: policy(), pool, liveValue: "sk-aaa", balances: balances(40, 3), spends: {}, now });
check("余额健康不切换", action === null, JSON.stringify(action));

// 3) 阈值：候选也见底 → 不乱切
action = decideAction({ policy: policy(), pool, liveValue: "sk-aaa", balances: balances(2, 3), spends: {}, now });
check("没有健康候选时不切换", action === null, JSON.stringify(action));

// 4) 阈值：跨币种不硬切（USD 见底、CNY 充足 → 不动）
action = decideAction({
	policy: policy(),
	pool,
	liveValue: "sk-aaa",
	balances: { k1: { ok: true, currency: "USD", total: "2" }, k2: { ok: true, currency: "CNY", total: "900" } },
	spends: {},
	now
});
check("跨币种不按阈值切换", action === null, JSON.stringify(action));

// 5) 阈值：币种专属阈值生效（CNY 阈值 5，余额 6 不切）
action = decideAction({
	policy: policy(),
	pool,
	liveValue: "sk-aaa",
	balances: { k1: { ok: true, currency: "CNY", total: "6" }, k2: { ok: true, currency: "CNY", total: "50" } },
	spends: {},
	now
});
check("币种专属阈值生效", action === null, JSON.stringify(action));

// 6) 均衡：当前账户消耗比例明显更高 → 切到更少消耗的那把
const balancePolicy = policy({ autoSwitch: { enabled: false }, balance: { enabled: true } });
action = decideAction({
	policy: balancePolicy,
	pool,
	liveValue: "sk-aaa",
	balances: balances(50, 50),
	spends: {
		k1: { currency: "USD", spent: 40, points: 10 },  // 消耗 40/90 ≈ 44%
		k2: { currency: "USD", spent: 2, points: 10 }    // 消耗 2/52 ≈ 4%
	},
	now
});
check("消耗不均时触发均衡", action && action.reason === "balance" && action.to === "k2", JSON.stringify(action));

// 7) 均衡：差距在容差内 → 不动
action = decideAction({
	policy: balancePolicy,
	pool,
	liveValue: "sk-aaa",
	balances: balances(50, 50),
	spends: {
		k1: { currency: "USD", spent: 10, points: 10 },  // 10/60 ≈ 17%
		k2: { currency: "USD", spent: 9, points: 10 }    // 9/59 ≈ 15%
	},
	now
});
check("容差内不切换", action === null, JSON.stringify(action));

// 8) 权重：给当前 key 更高权重后，同样的消耗不再触发切换
action = decideAction({
	policy: policy({ autoSwitch: { enabled: false }, balance: { enabled: true, weights: { k1: 5 } } }),
	pool,
	liveValue: "sk-aaa",
	balances: balances(50, 50),
	spends: {
		k1: { currency: "USD", spent: 40, points: 10 },
		k2: { currency: "USD", spent: 2, points: 10 }
	},
	now
});
check("权重保护高配额账号", action === null, JSON.stringify(action));

// 9) 均衡：没有任何消耗 → 不动
action = decideAction({
	policy: balancePolicy,
	pool,
	liveValue: "sk-aaa",
	balances: balances(50, 50),
	spends: { k1: { currency: "USD", spent: 0 }, k2: { currency: "USD", spent: 0 } },
	now
});
check("零消耗不切换", action === null, JSON.stringify(action));

// 10) 余额读不到 → 不动
action = decideAction({ policy: policy(), pool, liveValue: "sk-aaa", balances: { k1: { ok: false } }, spends: {}, now });
check("余额缺失不切换", action === null, JSON.stringify(action));

// 11) 冷却
check("冷却期内返回 true", withinCooldown(policy({ state: { lastSwitchAt: now - 60 * 1000 } }), now) === true);
check("冷却期外返回 false", withinCooldown(policy({ state: { lastSwitchAt: now - 60 * 60 * 1000 } }), now) === false);

// 12) 消耗窗口：首尾差、忽略失败样本、单点返回 null
const rows = [
	{ t: now - 3 * 3600 * 1000, k: "k1", c: "USD", b: "50.00", ok: true },
	{ t: now - 2 * 3600 * 1000, k: "k1", ok: false, e: "HTTP 500" },
	{ t: now - 1 * 3600 * 1000, k: "k1", c: "USD", b: "45.50", ok: true }
];
const spend = spendInWindow(rows, "k1", 7 * 24 * 3600 * 1000, now);
check("窗口消耗 = 4.50", spend && Math.abs(spend.spent - 4.5) < 1e-9, JSON.stringify(spend));
check("单点无消耗", spendInWindow(rows.slice(0, 1), "k1", 7 * 24 * 3600 * 1000, now) === null);

if (problems.length) {
	console.error("✗ 自动策略自测失败：");
	for (const problem of problems) console.error("  - " + problem);
	process.exit(1);
}

console.log("✓ 自动策略自测通过（阈值 / 均衡 / 权重 / 冷却 / 边界都对）");
