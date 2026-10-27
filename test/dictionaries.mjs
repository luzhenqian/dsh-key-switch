/**
 * 词典自测：用最小替身加载 client.js，执行 apply()，把每个语言的词典抓下来比对。
 *
 * 跑法：node test/dictionaries.mjs
 * 校验三件事：
 *   1. 六种语言的键集合完全一致（漏键会在界面上直接显示原始 key 名）
 *   2. 每个键都有非空译文
 *   3. {占位符} 在各语言里都保留（少了参数替换会失效）
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const dictionaries = new Map();
const languages = [];

globalThis.window = {
	__ModuleLoader__: {
		load(entry) {
			module_entry = entry;
		}
	}
};
var module_entry;

const noop = () => {};
const ReactStub = {
	createElement: () => null,
	useState: (initial) => [initial, noop],
	useEffect: noop,
	useReducer: (reducer, initial) => [initial, noop],
	Fragment: "Fragment"
};

globalThis.document = {
	getElementById: () => null,
	createElement: () => ({ set id(value) {}, textContent: "" }),
	head: { appendChild: noop },
	querySelector: () => null
};

const source = readFileSync(join(root, "lib/client.js"), "utf8");
// 顶层会调用 window.__ModuleLoader__.load，执行它拿到 factory。
new Function("window", source)(globalThis.window);

if (!module_entry) {
	console.error("✗ 没能从 client.js 里拿到模块定义");
	process.exit(1);
}

const exported = module_entry.factory((id) => {
	if (id === "react") return ReactStub;
	throw new Error(`unexpected require: ${id}`);
});

const ctx = {
	effect: (fn) => fn(),
	locale: {
		register(ns, localeOrDicts, dict) {
			if (typeof localeOrDicts === "string") dictionaries.set(localeOrDicts, dict);
			else for (const [locale, entries] of Object.entries(localeOrDicts)) dictionaries.set(locale, entries);
			noop();
		},
		addLanguage(input) {
			languages.push(input.id);
			noop();
		},
		bind() {
			return (key) => key;
		}
	},
	slots: {
		inject: noop,
		register: noop
	}
};

exported.apply(ctx);

const expected = ["zh", "en", "zh-Hant", "ja", "ko", "ru"];
const problems = [];

for (const locale of expected) {
	if (!dictionaries.has(locale)) problems.push(`缺少语言：${locale}`);
}

const base = dictionaries.get("en") || {};
const baseKeys = Object.keys(base).sort();

for (const locale of expected) {
	const dict = dictionaries.get(locale);
	if (!dict) continue;
	const keys = Object.keys(dict).sort();

	for (const key of baseKeys) {
		if (!(key in dict)) problems.push(`${locale} 缺键：${key}`);
	}
	for (const key of keys) {
		if (!(key in base)) problems.push(`${locale} 多出键：${key}`);
	}
	for (const key of keys) {
		const value = dict[key];
		if (typeof value !== "string" || value.trim() === "") problems.push(`${locale} 空译文：${key}`);
		const wanted = (base[key]?.match(/\{\w+\}/g) || []).sort().join(",");
		const got = (String(value).match(/\{\w+\}/g) || []).sort().join(",");
		if (wanted !== got) problems.push(`${locale} 占位符不一致 ${key}：期望 [${wanted}] 实际 [${got}]`);
	}
}

console.log(`语言：${[...dictionaries.keys()].join(", ")}`);
console.log(`可选语言注册：${languages.join(", ") || "(无)"}`);
console.log(`每种语言键数：${baseKeys.length}`);

if (problems.length) {
	console.error("\n✗ 发现问题：");
	for (const problem of problems) console.error("  - " + problem);
	process.exit(1);
}

console.log("\n✓ 六种语言的键、占位符全部一致");
