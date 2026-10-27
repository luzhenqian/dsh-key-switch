/**
 * dsh-key-switch —— 浏览器半边。
 *
 * 往 `settings.section` 注册一页「Key 切换」：列出 deepseek-official 上挂的
 * 多把 key（只显示掩码），点「使用」即切换，下一次模型调用生效。
 *
 * 只跟宿主路由说话，不自己碰凭据：真正的写值发生在 lib/index.js 里，走
 * harness 的 credentials seam。浏览器永远只拿到 ****后四位。
 */

window.__ModuleLoader__.load({
	id: "dsh-key-switch",
	factory: (require) => {
		var module = { exports: {} };

		const React = require("react");
		const h = React.createElement;

		const BASE = "/plugins/dsh-key-switch";
		const CSS_TAG_ID = "dsh-key-switch/styles.css";
		const SECTION_ORDER = 31;

		//#region 样式（用 inherit / 半透明描边，浅色深色都成立）

		function installStyles() {
			if (typeof document === "undefined") return;
			const existing = document.getElementById(CSS_TAG_ID);
			if (existing) return;
			const tag = document.createElement("style");
			tag.id = CSS_TAG_ID;
			tag.textContent = `
/* 全部字号/颜色走宿主的设计令牌（--dsw-*），浅色深色自动跟随。
   令牌缺失时退回后面的兜底值，不会因为宿主换版本就变透明/无色。 */
.ksw{display:flex;flex-direction:column;gap:16px;max-width:720px;padding-top:4px;color:var(--dsw-alias-label-primary,inherit);font:var(--dsw-font-xs-13,13px/20px inherit)}
.ksw-head{display:flex;flex-direction:column;gap:2px}
.ksw-title{font:var(--dsw-font-base-strong-16,600 16px/24px inherit);margin:0;color:var(--dsw-alias-label-primary,inherit)}
.ksw-sub{font:var(--dsw-font-xxs-12,12px/18px inherit);color:var(--dsw-alias-label-secondary,inherit)}
.ksw-hint{font:var(--dsw-font-xxxs-11,11px/14px inherit);color:var(--dsw-alias-label-caption,inherit)}
.ksw-mono{font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,SFMono-Regular,Menlo,monospace)}
.ksw-balance{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-secondary,inherit)}
.ksw-balance.big{font:var(--dsw-font-xs-strong-13,600 13px/20px inherit);color:var(--dsw-alias-label-primary,inherit)}

/* 设置页里的卡片 */
.ksw-block{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-layer-2,transparent)}
.ksw-blockHead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.ksw-prov{font:var(--dsw-font-xs-strong-13,600 13px/20px inherit);color:var(--dsw-alias-label-primary,inherit)}
.ksw-ref{font-size:var(--dsw-font-xxs-12-font-size,12px);line-height:var(--dsw-font-xxs-12-line-height,18px);font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,Menlo,monospace);color:var(--dsw-alias-label-tertiary,inherit)}
.ksw-live{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.10))}
.ksw-liveLabel{color:var(--dsw-alias-label-secondary,inherit)}
.ksw-rows{display:flex;flex-direction:column;gap:6px}
.ksw-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22));border-radius:8px}
.ksw-note{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,inherit)}
.ksw-note.empty{color:var(--dsw-alias-label-tertiary,inherit)}

/* 侧边栏底部入口 */
.ksw-entry{display:flex;align-items:center;gap:7px;width:100%;padding:5px 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:var(--dsw-font-xs-13,13px/20px inherit);cursor:pointer;text-align:left}
.ksw-entry:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,inherit)}
.ksw-entry-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#4aa46b);flex:0 0 auto}
.ksw-entry-text{font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 弹出面板：挂在 shell.overlay 上，不在 .ksw 容器里，字号必须在这里钉住 */
.ksw-layer{position:fixed;inset:0;z-index:80}
.ksw-backdrop{position:absolute;inset:0;background:transparent}
.ksw-pop{position:absolute;left:8px;bottom:56px;width:min(340px,calc(100vw - 16px));max-height:min(60vh,480px);overflow:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:12px;border:1px solid var(--dsw-elevation-stroke-color,var(--dsw-alias-border-l2,rgba(127,127,127,.3)));background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-3,#242528));box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.28));color:var(--dsw-alias-label-primary,inherit);font:var(--dsw-font-xs-13,13px/20px inherit)}
.ksw-pop-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 4px}
.ksw-pop-title{font:var(--dsw-font-xs-strong-13,600 13px/20px inherit)}
.ksw-pop-list{display:flex;flex-direction:column;gap:1px}
.ksw-item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:var(--dsw-font-xs-13,13px/20px inherit);cursor:pointer;text-align:left}
.ksw-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.ksw-item.active{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.14))}
.ksw-item:disabled{opacity:.6;cursor:default}
.ksw-item-note{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,inherit)}
.ksw-item-mask{font-size:var(--dsw-font-xxs-12-font-size,12px);line-height:var(--dsw-font-xxs-12-line-height,18px);font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,Menlo,monospace);color:var(--dsw-alias-label-tertiary,inherit)}
.ksw-item-bal{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-secondary,inherit)}
.ksw-pop-foot{display:flex;justify-content:flex-end;gap:6px;padding:4px 6px 2px}

/* 按钮 / 徽章 / 输入框：照官方设置面板的描边式控件 */
.ksw-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.38));background:transparent;color:var(--dsw-alias-label-primary,inherit);font:var(--dsw-font-xxs-12,12px/18px inherit);cursor:pointer;white-space:nowrap}
.ksw-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.ksw-btn:disabled{opacity:.4;cursor:default}
.ksw-btn.primary{border-color:var(--dsw-alias-brand-primary,rgba(127,127,127,.5));font:var(--dsw-font-xxs-strong-12,500 12px/18px inherit)}
.ksw-btn.danger{border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.38));color:var(--dsw-alias-state-error-primary,#c85252)}
.ksw-badge{font:var(--dsw-font-xxxs-strong-11,500 11px/14px inherit);padding:1px 6px;border-radius:6px;background:var(--dsw-alias-state-success-tertiary,rgba(80,170,110,.18));color:var(--dsw-alias-state-success-primary,#3f9b62);white-space:nowrap}
.ksw-form{display:flex;flex-direction:column;gap:6px}
.ksw-label{font:var(--dsw-font-xxs-12,12px/18px inherit);color:var(--dsw-alias-label-secondary,inherit)}
.ksw-input{font:var(--dsw-font-xs-13,13px/20px inherit);height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.38));background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);width:100%;box-sizing:border-box}
.ksw-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,rgba(127,127,127,.6))}
.ksw-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.ksw-msg{padding:6px 10px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,inherit);font:var(--dsw-font-xxs-12,12px/18px inherit)}
.ksw-msg.err{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#c85252) 14%,transparent);color:var(--dsw-alias-state-error-primary,#c85252)}
`;
			document.head.appendChild(tag);
		}

		//#endregion

		const REQUEST_TIMEOUT_MS = 3500;
		const RETRY_DELAY_MS = 900;
		const RETRY_ATTEMPTS = 3;

		function sleep(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		/** 一次请求，带超时——宿主偶发不回响应时不能把界面吊死。 */
		async function once(path, payload) {
			const controller = typeof AbortController === "function" ? new AbortController() : null;
			const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
			const init = payload === undefined
				? { method: "GET", cache: "no-store", credentials: "same-origin" }
				: {
					method: "POST",
					cache: "no-store",
					credentials: "same-origin",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				};
			if (controller) init.signal = controller.signal;
			try {
				const response = await fetch(`${BASE}/${path}`, init);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return await response.json();
			} finally {
				if (timer) clearTimeout(timer);
			}
		}

		/** 带重试的调用：这套宿主上首次请求偶尔会挂住，重试一次就通了。 */
		async function call(path, payload) {
			let lastError;
			for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
				try {
					return await once(path, payload);
				} catch (error) {
					lastError = error;
					if (attempt < RETRY_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS);
				}
			}
			throw lastError;
		}

		const CURRENCY_SIGN = { CNY: "¥", USD: "$" };

		/** 把宿主返回的余额条目格式化成一行文字；失败就说失败，不装作没数据。 */
		function moneyTextOf(entry) {
			if (!entry) return "";
			if (!entry.ok) return entry.error ? `⚠ ${entry.error}` : "⚠ 查询失败";
			const list = Array.isArray(entry.all) && entry.all.length
				? entry.all
				: [{ currency: entry.currency, total: entry.total }];
			return list
				.map((info) => {
					const sign = CURRENCY_SIGN[info.currency] || "";
					const amount = info.total === "" || info.total === undefined ? "?" : info.total;
					return sign ? `${sign}${amount}` : `${amount} ${info.currency || ""}`.trim();
				})
				.join(" / ");
		}

		function timeTextOf(ms) {
			if (!ms) return "";
			const date = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}

		function KeySwitchPage() {
			const [state, setState] = React.useState({ loading: true, providers: [] });
			const [msg, setMsg] = React.useState("");
			const [msgKind, setMsgKind] = React.useState("ok");
			const [busy, setBusy] = React.useState(false);
			const [forms, setForms] = React.useState({});

			const formOf = (providerId) => forms[providerId] || { value: "", note: "" };

			function setForm(providerId, patch) {
				setForms((current) => ({ ...current, [providerId]: { ...(current[providerId] || { value: "", note: "" }), ...patch } }));
			}

			function flash(text, kind) {
				setMsg(text || "");
				setMsgKind(kind === "err" ? "err" : "ok");
			}

			async function load() {
				try {
					const data = await call("state");
					let balances = {};
					let balanceAt = 0;
					try {
						const result = await call("balances");
						balances = (result && result.results) || {};
						balanceAt = (result && result.at) || 0;
					} catch (error) {
						// 余额查不到不影响切换：池子和当前 key 照常显示。
						balances = {};
					}
					setState({ loading: false, providers: (data && data.providers) || [], balances, balanceAt });
				} catch (error) {
					setState({ loading: false, providers: [], balances: {}, balanceAt: 0 });
					flash(`读取失败：${error && error.message ? error.message : String(error)}`, "err");
				}
			}

			React.useEffect(() => { load(); }, []);

			/** 绕过 60 秒缓存重新查一遍余额。 */
			async function refreshBalances() {
				setBusy(true);
				try {
					const result = await call("balances?fresh=1");
					setState((current) => ({ ...current, balances: (result && result.results) || {}, balanceAt: (result && result.at) || Date.now() }));
					flash("余额已刷新");
				} catch (error) {
					flash(`余额刷新失败：${error && error.message ? error.message : String(error)}`, "err");
				} finally {
					setBusy(false);
				}
			}

			async function run(action, payload, okText) {
				setBusy(true);
				try {
					const result = await action(payload);
					if (!result || result.ok === false) {
						flash((result && result.error) || "操作失败", "err");
						return false;
					}
					flash(okText);
					await load();
					return true;
				} catch (error) {
					flash(`请求失败：${error && error.message ? error.message : String(error)}`, "err");
					return false;
				} finally {
					setBusy(false);
				}
			}

			async function addKey(providerId) {
				const form = formOf(providerId);
				const value = String(form.value || "").trim();
				if (!value) {
					flash("先粘贴密钥值", "err");
					return;
				}
				const ok = await run((p) => call("add", p), { providerId, note: form.note, value }, "已加入池子");
				if (ok) setForm(providerId, { value: "", note: "" });
			}

			function renderProvider(provider) {
				const balances = state.balances || {};
				const balanceOf = (keyId) => moneyTextOf(balances[keyId]);

				const rows = (provider.keys || []).map((key) => h("div", { className: "ksw-row", key: key.id },
					h("span", { className: key.note ? "ksw-note" : "ksw-note empty" }, key.note || "（无备注）"),
					h("span", { className: "ksw-mono" }, key.masked),
					h("span", { className: "ksw-balance" }, balanceOf(key.id) || "—"),
					key.active
						? h("span", { className: "ksw-badge" }, "使用中")
						: h("button", {
							className: "ksw-btn",
							type: "button",
							disabled: busy,
							onClick: () => run((p) => call("activate", p), { providerId: provider.providerId, id: key.id }, `已切换到 ${key.masked}`)
						}, "使用"),
					h("button", {
						className: "ksw-btn danger",
						type: "button",
						disabled: busy,
						onClick: () => run((p) => call("remove", p), { providerId: provider.providerId, id: key.id }, "已删除")
					}, "删除")
				));

				const activeKey = (provider.keys || []).find((key) => key.active);
				const liveBalance = activeKey ? balanceOf(activeKey.id) : moneyTextOf(balances[`live:${provider.ref}`]);

				const form = formOf(provider.providerId);

				return h("div", { className: "ksw-block", key: provider.providerId },
					h("div", { className: "ksw-blockHead" },
						h("span", { className: "ksw-prov" }, provider.displayName || provider.providerId),
						h("span", { className: "ksw-ref" }, `凭据名 ${provider.ref || "—"}`),
						liveBalance ? h("span", { className: "ksw-balance big" }, liveBalance) : null
					),
					h("div", { className: "ksw-live" },
						h("span", { className: "ksw-liveLabel" }, "当前生效"),
						h("span", { className: "ksw-mono" }, provider.liveMasked || "（未读到）"),
						liveBalance ? h("span", { className: "ksw-balance" }, liveBalance) : null,
						provider.liveMasked && !provider.liveInPool
							? h("span", { className: "ksw-sub" }, "— 不在池子里，把它加进来才能切回来")
							: null
					),
					provider.shadowedByEnv
						? h("div", { className: "ksw-sub" }, `⚠️ 环境变量里也有 ${provider.ref}，它会盖住文件里的值；切换不会生效，先把这个环境变量去掉。`)
						: null,
					(rows.length ? h("div", { className: "ksw-rows" }, rows) : h("div", { className: "ksw-sub" }, "池子是空的，先加一把。")),
					h("div", { className: "ksw-form" },
						h("label", { className: "ksw-label" }, "添加密钥"),
						h("input", {
							className: "ksw-input",
							// 故意用 text 而不是 password：密码框会招来密码管理器和部分扩展的浮层，
							// 那个浮层会抢走焦点，输入会中断。
							type: "text",
							autoComplete: "off",
							spellCheck: false,
							placeholder: "粘贴 API Key（sk-…）",
							value: form.value,
							onChange: (event) => setForm(provider.providerId, { value: event.target.value })
						}),
						h("input", {
							className: "ksw-input",
							autoComplete: "off",
							placeholder: "备注，例如：账号A / 团队号",
							value: form.note,
							onChange: (event) => setForm(provider.providerId, { note: event.target.value }),
							onKeyDown: (event) => { if (event.key === "Enter") addKey(provider.providerId); }
						}),
						h("div", { className: "ksw-actions" },
							h("button", {
								className: "ksw-btn primary",
								type: "button",
								disabled: busy,
								onClick: () => addKey(provider.providerId)
							}, "添加")
						)
					)
				);
			}

			const providers = state.providers || [];
			const body = [];

			body.push(h("div", { className: "ksw-head", key: "head" },
				h("h3", { className: "ksw-title" }, "Key 切换"),
				h("div", { className: "ksw-sub" },
					"同一套 key 池挂在 deepseek-official 路由下，点「使用」就换掉凭据里的值，下一次模型调用生效，不用重启。余额由宿主进程直接向 api.deepseek.com 查询。")
			));

			if (state.loading) {
				body.push(h("div", { className: "ksw-sub", key: "loading" }, "读取中…"));
			} else if (!providers.length) {
				body.push(h("div", { className: "ksw-sub", key: "empty" }, "没有发现可管理的 provider。"));
			} else {
				providers.forEach((provider) => body.push(renderProvider(provider)));
			}

			// 手动重试：浏览器到本机的连接被占满时请求会排队，关掉多余的 DSH 标签页再点它。
			body.push(h("div", { className: "ksw-actions", key: "reload" },
				state.balanceAt ? h("span", { className: "ksw-hint" }, `余额更新于 ${timeTextOf(state.balanceAt)}`) : null,
				h("button", { className: "ksw-btn", type: "button", disabled: busy, onClick: refreshBalances }, "刷新余额"),
				h("button", { className: "ksw-btn", type: "button", disabled: busy, onClick: () => { flash(""); load(); } }, "重新读取")
			));

			if (msg) body.push(h("div", { className: `ksw-msg${msgKind === "err" ? " err" : ""}`, key: "msg" }, msg));

			return h("div", { className: "ksw" }, body);
		}

		//#region 共享状态：侧边栏入口和弹出面板看同一份数据

		const store = {
			open: false,
			ready: false,
			busy: false,
			error: "",
			providers: [],
			balances: {},
			at: 0,
			listeners: new Set()
		};

		function emit() {
			store.listeners.forEach((listener) => {
				try {
					listener();
				} catch (error) {
					// 单个订阅者出错不影响其它人
				}
			});
		}

		/** 订阅共享状态；组件卸载时退订。 */
		function useStore() {
			const [, force] = React.useReducer((n) => n + 1, 0);
			React.useEffect(() => {
				store.listeners.add(force);
				return () => store.listeners.delete(force);
			}, []);
			return store;
		}

		async function refreshStore(fresh) {
			store.busy = true;
			emit();
			try {
				const state = await call("state");
				let balances = {};
				let at = 0;
				try {
					const result = await call(fresh ? "balances?fresh=1" : "balances");
					balances = (result && result.results) || {};
					at = (result && result.at) || 0;
				} catch (error) {
					balances = {};
				}
				store.providers = (state && state.providers) || [];
				store.balances = balances;
				store.at = at;
				store.error = "";
				store.ready = true;
			} catch (error) {
				store.error = error && error.message ? error.message : String(error);
				store.ready = true;
			} finally {
				store.busy = false;
				emit();
			}
		}

		/** 当前生效那把 key 的余额文字（池子里找不到就按 live:<ref> 取）。 */
		function activeBalanceText(snapshot) {
			const provider = (snapshot.providers || [])[0];
			if (!provider) return "";
			const active = (provider.keys || []).find((key) => key.active);
			if (active) return moneyTextOf(snapshot.balances[active.id]);
			return moneyTextOf(snapshot.balances[`live:${provider.ref}`]);
		}

		/** 打开设置窗口：目前没有官方 open 接口，点一下侧边栏那个「设置」按钮。 */
		function openSettings() {
			store.open = false;
			emit();
			if (typeof document === "undefined") return;
			const trigger = document.querySelector('[aria-label="设置"]');
			if (trigger && typeof trigger.click === "function") trigger.click();
			// 弹窗异步挂载，等它渲染出来再把导航切到我们这页；找不到就停在默认页，不影响使用。
			setTimeout(() => {
				try {
					const dialog = document.querySelector('[role="dialog"]');
					if (!dialog) return;
					for (const button of dialog.querySelectorAll("button")) {
						if ((button.textContent || "").trim() === "Key 切换") {
							button.click();
							return;
						}
					}
				} catch (error) {
					// 忽略：停在默认分区也能用
				}
			}, 260);
		}

		let pollTimer = null;

		function ensurePolling() {
			if (pollTimer !== null || typeof window === "undefined") return;
			pollTimer = window.setInterval(() => {
				if (store.busy) return;
				refreshStore(false);
			}, 60_000);
		}

		//#endregion

		/** 侧边栏底部入口：实时余额 + 点击展开切换面板。 */
		function QuotaEntry() {
			const snapshot = useStore();
			React.useEffect(() => {
				ensurePolling();
				if (!snapshot.ready && !snapshot.busy) refreshStore(false);
			}, []);

			const text = activeBalanceText(snapshot);
			const count = ((snapshot.providers || [])[0] || {}).keys || [];
			const label = snapshot.error
				? "⚠ 余额不可用"
				: text || (snapshot.ready ? "余额 —" : "读取中…");

			return h("button", {
				className: "ksw-entry",
				type: "button",
				title: count.length ? `共 ${count.length} 把 key，点击切换` : "点击切换 key",
				onClick: () => {
					store.open = !store.open;
					emit();
					if (store.open) refreshStore(false);
				}
			}, h("span", { className: "ksw-entry-dot" }), h("span", { className: "ksw-entry-text" }, label));
		}

		/** 点击入口后弹出的面板（挂在 shell.overlay 上，不会被侧边栏裁切）。 */
		function KeyPanel() {
			const snapshot = useStore();
			if (!snapshot.open) return null;

			const provider = (snapshot.providers || [])[0];
			const keys = (provider && provider.keys) || [];

			async function use_(keyId) {
				store.busy = true;
				emit();
				try {
					const result = await call("activate", { providerId: provider.providerId, id: keyId });
					if (result && result.ok === false) {
						store.error = result.error || "切换失败";
					} else {
						store.error = "";
					}
				} catch (error) {
					store.error = error && error.message ? error.message : String(error);
				} finally {
					store.busy = false;
					emit();
					await refreshStore(true);
				}
			}

			const rows = keys.map((key) => h("button", {
				className: `ksw-item${key.active ? " active" : ""}`,
				type: "button",
				key: key.id,
				disabled: snapshot.busy,
				onClick: () => { if (!key.active) use_(key.id); }
			},
				h("span", { className: "ksw-item-note" }, key.note || "（无备注）"),
				h("span", { className: "ksw-item-mask ksw-mono" }, key.masked),
				h("span", { className: "ksw-item-bal" }, moneyTextOf(snapshot.balances[key.id]) || "—"),
				key.active ? h("span", { className: "ksw-badge" }, "使用中") : null
			));

			return h("div", { className: "ksw-layer" },
				h("div", { className: "ksw-backdrop", onClick: () => { store.open = false; emit(); } }),
				h("div", { className: "ksw-pop", role: "dialog", "aria-label": "Key 切换" },
					h("div", { className: "ksw-pop-head" },
						h("span", { className: "ksw-pop-title" }, "Key 切换"),
						h("span", { className: "ksw-hint" }, snapshot.at ? `更新于 ${timeTextOf(snapshot.at)}` : "")
					),
					rows.length ? h("div", { className: "ksw-pop-list" }, rows) : h("div", { className: "ksw-sub" }, "池子是空的，去设置里加一把。"),
					snapshot.error ? h("div", { className: "ksw-msg err" }, snapshot.error) : null,
					h("div", { className: "ksw-pop-foot" },
						h("button", { className: "ksw-btn", type: "button", disabled: snapshot.busy, onClick: () => refreshStore(true) }, "刷新余额"),
						h("button", { className: "ksw-btn primary", type: "button", onClick: openSettings }, "管理密钥…")
					)
				)
			);
		}

		const name = "dsh-key-switch";
		const inject = ["slots"];

		function apply(ctx) {
			installStyles();
			ctx.slots.inject("settings.section", () =>
				ctx.slots.register(
					{
						name: "settings.section",
						id: "key-switch",
						order: SECTION_ORDER,
						label: () => "Key 切换"
					},
					() => h(KeySwitchPage, null)
				)
			);
			ctx.slots.inject("sidebar.footer.action", () =>
				ctx.slots.register(
					{
						name: "sidebar.footer.action",
						id: "key-switch-entry",
						order: 8
					},
					() => h(QuotaEntry, null)
				)
			);
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register(
					{
						name: "shell.overlay",
						id: "key-switch-panel",
						order: 8,
						label: () => "Key 切换"
					},
					() => h(KeyPanel, null)
				)
			);
		}

		module.exports = { name, inject, apply };
		return module.exports;
	}
});
