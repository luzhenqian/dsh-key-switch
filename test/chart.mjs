/**
 * 图表路径自测：从 client.js 里截出 buildStepPath 源码，在 Node 里跑断言。
 * 跑法：node test/chart.mjs
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
const start = src.indexOf("function buildStepPath(");
const end = src.indexOf("/** 弹层每行的小折线", start);
if (start < 0 || end < 0) throw new Error("找不到 buildStepPath");
const buildStepPath = new Function(src.slice(start, end) + "; return buildStepPath;")();

const problems = [];
const check = (name, cond, detail) => { if (!cond) problems.push(`${name}${detail ? "：" + detail : ""}`); };
const HOUR = 3600e3;
const now = Date.now();

// 1) 79 个缓慢下跌点：应当是一段连续折线，且被抽稀
const slow = Array.from({ length: 79 }, (_, i) => ({ t: now - (78 - i) * 20 * 60e3, v: (56 - i * 0.02).toFixed(2), ok: true }));
const p1 = buildStepPath(slow, 600, 120, 6);
check("缓慢序列能出路径", Boolean(p1));
const moves = (p1.d.match(/M /g) || []).length;
const lines = (p1.d.match(/L /g) || []).length;
check("缓慢序列只有一段（无断口）", p1.d.startsWith("M") && moves === 1, `M=${moves}`);
check("抽稀后点数明显减少", lines + 1 < 79, `线段数=${lines}`);
check("直线上至少有一段线段", lines >= 1, `线段数=${lines}`);

// 2) 中间断档 6 小时：应断成两段
const gapped = [...slow.slice(0, 20), ...slow.slice(20).map((x) => ({ ...x, t: x.t + 6 * HOUR }))];
const p2 = buildStepPath(gapped, 600, 120, 6);
check("断档切成两段", (p2.d.match(/M /g) || []).length === 2, p2.d.slice(0, 80));

// 3) 末尾断崖：必须保留（末段跨度大）
const cliff = [...slow.slice(0, 60), ...slow.slice(60).map((x, i) => ({ ...x, v: String(52 - i * 0.5) }))];
const p3 = buildStepPath(cliff, 600, 120, 6);
check("断崖保留", Boolean(p3) && p3.d.includes("L"), "");
const ys = p3.d.match(/[\d.]+/g).map(Number).filter((_, i) => i % 2 === 1);
check("断崖末端明显更低", Math.max(...ys) - Math.min(...ys) > 40, `跨度=${(Math.max(...ys) - Math.min(...ys)).toFixed(1)}`);

// 4) 单点 / 空数据
check("单点不出图", buildStepPath([{ t: now, v: "1", ok: true }], 600, 120, 6) === null);
check("空数据不出图", buildStepPath([], 600, 120, 6) === null);
check("全是失败点不出图", buildStepPath([{ t: now, ok: false }, { t: now - HOUR, ok: false }], 600, 120, 6) === null);

if (problems.length) {
  console.error("✗ 图表自测失败：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`✓ 图表自测通过（缓慢序列 ${lines + 1} 个顶点，断档切分与断崖保留正常）`);
