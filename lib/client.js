/**
 * dsh-key-switch —— 浏览器半边。
 *
 * 往 `settings.section` 注册一页「API Key 管理」：列出 deepseek-official 上挂的
 * 多把 key（只显示掩码），点「使用」即切换，下一次模型调用生效。侧边栏底部还有
 * 一个常驻入口，显示当前 key 的余额，点开即可切换。
 *
 * 只跟宿主路由说话，不自己碰凭据：真正的写值发生在 lib/index.js 里。浏览器
 * 永远只拿到 ****后四位。
 *
 * 界面文案全部走宿主 locale 服务：内置 zh / en，另外注册 zh-Hant / ja / ko / ru
 * 四种可选语言（回退链都终止于 en）。
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
		const NS = "dsh-key-switch";

		//#region 词典

		const zh = {
			title: "API Key 管理",
			subtitle: "同一套 key 池挂在 deepseek-official 路由下，点「使用」就换掉凭据里的值，下一次模型调用生效，不用重启。余额由宿主进程直接向 api.deepseek.com 查询。",
			ref: "凭据名 {ref}",
			current: "当前生效",
			noLive: "（未读到）",
			notInPool: "— 不在池子里，把它加进来才能切回来",
			envShadow: "⚠️ 环境变量里也有 {ref}，它会盖住文件里的值；切换不会生效，先把这个环境变量去掉。",
			poolEmpty: "池子是空的，先加一把。",
			noNote: "（无备注）",
			use: "使用",
			inUse: "使用中",
			remove: "删除",
			addKey: "添加密钥",
			keyPlaceholder: "粘贴 API Key（sk-…）",
			notePlaceholder: "备注，例如：账号A / 团队号",
			add: "添加",
			balanceUpdatedAt: "余额更新于 {time}",
			refreshBalance: "刷新余额",
			reload: "重新读取",
			loading: "读取中…",
			loadFailed: "读取失败：{message}",
			noProvider: "没有发现可管理的 provider。",
			entryTitleCount: "共 {count} 把 key，点击切换",
			entryTitle: "点击切换 key",
			entryUnavailable: "⚠ 余额不可用",
			entryEmpty: "余额 —",
			updatedAt: "更新于 {time}",
			manage: "管理密钥…",
			activated: "已切换到 {mask}",
			removed: "已删除",
			added: "已加入池子",
			needKey: "先粘贴密钥值",
			opFailed: "操作失败",
			requestFailed: "请求失败：{message}",
			balanceRefreshed: "余额已刷新",
			balanceRefreshFailed: "余额刷新失败：{message}",
			queryFailed: "⚠ 查询失败",
			"err.unknown-provider": "未知的 provider",
			"err.empty-key": "密钥不能为空",
			"err.whitespace": "密钥里不能有空白字符",
			"err.duplicate": "这把密钥已经在列表里了",
			"err.not-found": "找不到这把密钥",
			"err.no-keys": "这个 provider 下还没有密钥",
			"err.write-failed": "写入凭据文件失败",
			"err.verify-mismatch": "写入后校验不一致：凭据文件可能被别的进程同时改过"
		};

		const en = {
			title: "API Key Manager",
			subtitle: "All keys share the deepseek-official route. Clicking “Use” rewrites the credential value and the next model call picks it up — no restart. Balances are queried by the host process straight from api.deepseek.com.",
			ref: "Credential {ref}",
			current: "Active",
			noLive: "(not readable)",
			notInPool: "— not in the pool yet; add it to switch back",
			envShadow: "⚠️ The environment also defines {ref}, which wins over the file. Switching will not take effect until you remove it.",
			poolEmpty: "The pool is empty. Add a key first.",
			noNote: "(no note)",
			use: "Use",
			inUse: "In use",
			remove: "Delete",
			addKey: "Add key",
			keyPlaceholder: "Paste an API key (sk-…)",
			notePlaceholder: "Note, e.g. personal / team",
			add: "Add",
			balanceUpdatedAt: "Balance updated {time}",
			refreshBalance: "Refresh",
			reload: "Reload",
			loading: "Loading…",
			loadFailed: "Load failed: {message}",
			noProvider: "No manageable provider found.",
			entryTitleCount: "{count} keys — click to switch",
			entryTitle: "Click to switch keys",
			entryUnavailable: "⚠ Balance unavailable",
			entryEmpty: "Balance —",
			updatedAt: "updated {time}",
			manage: "Manage keys…",
			activated: "Switched to {mask}",
			removed: "Deleted",
			added: "Added to the pool",
			needKey: "Paste a key first",
			opFailed: "Operation failed",
			requestFailed: "Request failed: {message}",
			balanceRefreshed: "Balance refreshed",
			balanceRefreshFailed: "Balance refresh failed: {message}",
			queryFailed: "⚠ Query failed",
			"err.unknown-provider": "Unknown provider",
			"err.empty-key": "The key cannot be empty",
			"err.whitespace": "The key cannot contain whitespace",
			"err.duplicate": "This key is already in the pool",
			"err.not-found": "That key was not found",
			"err.no-keys": "This provider has no keys yet",
			"err.write-failed": "Could not write the credential file",
			"err.verify-mismatch": "Read-back mismatch: the credential file changed concurrently"
		};

		const zhHant = {
			title: "API Key 管理",
			subtitle: "同一套 key 池掛在 deepseek-official 路由下，點「使用」就換掉憑證裡的值，下一次模型呼叫生效，不用重啟。餘額由宿主程序直接向 api.deepseek.com 查詢。",
			ref: "憑證名 {ref}",
			current: "目前生效",
			noLive: "（未讀到）",
			notInPool: "— 不在池子裡，把它加進來才能切回來",
			envShadow: "⚠️ 環境變數裡也有 {ref}，它會蓋掉檔案裡的值；切換不會生效，先移除這個環境變數。",
			poolEmpty: "池子是空的，先加一把。",
			noNote: "（無備註）",
			use: "使用",
			inUse: "使用中",
			remove: "刪除",
			addKey: "新增金鑰",
			keyPlaceholder: "貼上 API Key（sk-…）",
			notePlaceholder: "備註，例如：個人帳號 / 公司帳號",
			add: "新增",
			balanceUpdatedAt: "餘額更新於 {time}",
			refreshBalance: "重新整理餘額",
			reload: "重新讀取",
			loading: "讀取中…",
			loadFailed: "讀取失敗：{message}",
			noProvider: "沒有發現可管理的 provider。",
			entryTitleCount: "共 {count} 把 key，點擊切換",
			entryTitle: "點擊切換 key",
			entryUnavailable: "⚠ 餘額不可用",
			entryEmpty: "餘額 —",
			updatedAt: "更新於 {time}",
			manage: "管理金鑰…",
			activated: "已切換到 {mask}",
			removed: "已刪除",
			added: "已加入池子",
			needKey: "先貼上金鑰值",
			opFailed: "操作失敗",
			requestFailed: "請求失敗：{message}",
			balanceRefreshed: "餘額已更新",
			balanceRefreshFailed: "餘額更新失敗：{message}",
			queryFailed: "⚠ 查詢失敗",
			"err.unknown-provider": "未知的 provider",
			"err.empty-key": "金鑰不能為空",
			"err.whitespace": "金鑰不能含空白字元",
			"err.duplicate": "這把金鑰已經在清單裡了",
			"err.not-found": "找不到這把金鑰",
			"err.no-keys": "這個 provider 底下還沒有金鑰",
			"err.write-failed": "寫入憑證檔失敗",
			"err.verify-mismatch": "寫入後校驗不一致：憑證檔可能被其他程序同時改過"
		};

		const ja = {
			title: "API キー管理",
			subtitle: "すべてのキーは deepseek-official ルートを共有します。「使用」を押すと資格情報の値が書き換わり、次回のモデル呼び出しから有効になります（再起動不要）。残高はホストプロセスが api.deepseek.com へ直接問い合わせます。",
			ref: "資格情報 {ref}",
			current: "現在有効",
			noLive: "（読み取れません）",
			notInPool: "— プールにありません。追加すると切り戻せます",
			envShadow: "⚠️ 環境変数にも {ref} が定義されており、ファイルの値より優先されます。削除するまで切り替えは反映されません。",
			poolEmpty: "プールは空です。まずキーを追加してください。",
			noNote: "（メモなし）",
			use: "使用",
			inUse: "使用中",
			remove: "削除",
			addKey: "キーを追加",
			keyPlaceholder: "API キーを貼り付け（sk-…）",
			notePlaceholder: "メモ（例：個人 / チーム）",
			add: "追加",
			balanceUpdatedAt: "残高更新 {time}",
			refreshBalance: "残高を更新",
			reload: "再読み込み",
			loading: "読み込み中…",
			loadFailed: "読み込み失敗：{message}",
			noProvider: "管理できる provider が見つかりません。",
			entryTitleCount: "{count} 個のキー — クリックで切り替え",
			entryTitle: "クリックでキーを切り替え",
			entryUnavailable: "⚠ 残高を取得できません",
			entryEmpty: "残高 —",
			updatedAt: "{time} 更新",
			manage: "キーを管理…",
			activated: "{mask} に切り替えました",
			removed: "削除しました",
			added: "プールに追加しました",
			needKey: "先にキーを貼り付けてください",
			opFailed: "操作に失敗しました",
			requestFailed: "リクエスト失敗：{message}",
			balanceRefreshed: "残高を更新しました",
			balanceRefreshFailed: "残高の更新に失敗：{message}",
			queryFailed: "⚠ 取得失敗",
			"err.unknown-provider": "不明な provider です",
			"err.empty-key": "キーを入力してください",
			"err.whitespace": "キーに空白文字は使えません",
			"err.duplicate": "このキーはすでにプールにあります",
			"err.not-found": "キーが見つかりません",
			"err.no-keys": "この provider にはまだキーがありません",
			"err.write-failed": "資格情報ファイルの書き込みに失敗しました",
			"err.verify-mismatch": "書き込み後の照合が一致しません（同時更新の可能性）"
		};

		const ko = {
			title: "API 키 관리",
			subtitle: "모든 키는 deepseek-official 라우트를 공유합니다. 「사용」을 누르면 자격 증명 값이 바뀌고 다음 모델 호출부터 적용됩니다(재시작 불필요). 잔액은 호스트 프로세스가 api.deepseek.com 에 직접 조회합니다.",
			ref: "자격 증명 {ref}",
			current: "현재 적용",
			noLive: "(읽을 수 없음)",
			notInPool: "— 아직 풀에 없습니다. 추가해야 되돌릴 수 있습니다",
			envShadow: "⚠️ 환경 변수에도 {ref} 가 있어 파일 값보다 우선합니다. 제거하기 전에는 전환이 적용되지 않습니다.",
			poolEmpty: "풀이 비어 있습니다. 먼저 키를 추가하세요.",
			noNote: "(메모 없음)",
			use: "사용",
			inUse: "사용 중",
			remove: "삭제",
			addKey: "키 추가",
			keyPlaceholder: "API 키 붙여넣기 (sk-…)",
			notePlaceholder: "메모 (예: 개인 / 팀)",
			add: "추가",
			balanceUpdatedAt: "잔액 갱신 {time}",
			refreshBalance: "잔액 새로고침",
			reload: "다시 읽기",
			loading: "불러오는 중…",
			loadFailed: "불러오기 실패: {message}",
			noProvider: "관리할 수 있는 provider 가 없습니다.",
			entryTitleCount: "키 {count}개 — 클릭하여 전환",
			entryTitle: "클릭하여 키 전환",
			entryUnavailable: "⚠ 잔액을 쓸 수 없음",
			entryEmpty: "잔액 —",
			updatedAt: "{time} 갱신",
			manage: "키 관리…",
			activated: "{mask} 로 전환했습니다",
			removed: "삭제했습니다",
			added: "풀에 추가했습니다",
			needKey: "먼저 키를 붙여넣으세요",
			opFailed: "작업 실패",
			requestFailed: "요청 실패: {message}",
			balanceRefreshed: "잔액을 새로고침했습니다",
			balanceRefreshFailed: "잔액 새로고침 실패: {message}",
			queryFailed: "⚠ 조회 실패",
			"err.unknown-provider": "알 수 없는 provider 입니다",
			"err.empty-key": "키를 입력하세요",
			"err.whitespace": "키에 공백을 쓸 수 없습니다",
			"err.duplicate": "이미 풀에 있는 키입니다",
			"err.not-found": "키를 찾을 수 없습니다",
			"err.no-keys": "이 provider 에는 아직 키가 없습니다",
			"err.write-failed": "자격 증명 파일 쓰기에 실패했습니다",
			"err.verify-mismatch": "쓰기 후 검증 불일치(동시 수정 가능)"
		};

		const ru = {
			title: "Управление API-ключами",
			subtitle: "Все ключи используют маршрут deepseek-official. Нажатие «Использовать» заменяет значение учётных данных, и следующий вызов модели идёт уже с ним — перезапуск не нужен. Баланс запрашивает процесс хоста напрямую с api.deepseek.com.",
			ref: "Учётные данные {ref}",
			current: "Активный",
			noLive: "(не удалось прочитать)",
			notInPool: "— его нет в пуле; добавьте, чтобы вернуться",
			envShadow: "⚠️ Переменная окружения {ref} тоже задана и перекрывает файл. Пока вы её не удалите, переключение не подействует.",
			poolEmpty: "Пул пуст. Сначала добавьте ключ.",
			noNote: "(без заметки)",
			use: "Использовать",
			inUse: "Используется",
			remove: "Удалить",
			addKey: "Добавить ключ",
			keyPlaceholder: "Вставьте API-ключ (sk-…)",
			notePlaceholder: "Заметка, напр. личный / рабочий",
			add: "Добавить",
			balanceUpdatedAt: "Баланс обновлён {time}",
			refreshBalance: "Обновить баланс",
			reload: "Перечитать",
			loading: "Загрузка…",
			loadFailed: "Ошибка загрузки: {message}",
			noProvider: "Подходящий provider не найден.",
			entryTitleCount: "Ключей: {count} — нажмите, чтобы переключить",
			entryTitle: "Нажмите, чтобы переключить ключ",
			entryUnavailable: "⚠ Баланс недоступен",
			entryEmpty: "Баланс —",
			updatedAt: "обновлено {time}",
			manage: "Управление ключами…",
			activated: "Переключено на {mask}",
			removed: "Удалено",
			added: "Добавлено в пул",
			needKey: "Сначала вставьте ключ",
			opFailed: "Операция не удалась",
			requestFailed: "Ошибка запроса: {message}",
			balanceRefreshed: "Баланс обновлён",
			balanceRefreshFailed: "Не удалось обновить баланс: {message}",
			queryFailed: "⚠ Ошибка запроса",
			"err.unknown-provider": "Неизвестный provider",
			"err.empty-key": "Ключ не может быть пустым",
			"err.whitespace": "Ключ не должен содержать пробелов",
			"err.duplicate": "Этот ключ уже есть в пуле",
			"err.not-found": "Ключ не найден",
			"err.no-keys": "У этого provider пока нет ключей",
			"err.write-failed": "Не удалось записать файл учётных данных",
			"err.verify-mismatch": "Проверка после записи не совпала: файл изменили параллельно"
		};

		/** 当前语言的翻译函数；apply 里换成 ctx.locale.bind(NS)。 */
		let t = (key, params) => {
			const template = en[key] ?? key;
			if (!params) return template;
			return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
		};

		//#endregion

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
.ksw-entry-icon{width:16px;height:16px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;opacity:.8}
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

/* 按钮 / 徽章 / 输入框：照官方设置面板的胶囊描边控件 */
.ksw-btn{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.38));background:transparent;color:var(--dsw-alias-label-primary,inherit);font:var(--dsw-font-xxs-12,12px/18px inherit);cursor:pointer;white-space:nowrap}
.ksw-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.ksw-btn:disabled{opacity:.4;cursor:default}
.ksw-btn.primary{background:var(--dsw-alias-button-primary-fill,#e6e6e6);color:var(--dsw-alias-label-primary-inverted,#1a1a1a);border-color:transparent;font:var(--dsw-font-xxs-strong-12,500 12px/18px inherit)}
.ksw-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#d8d8d8)}
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
		const CURRENCY_SIGN = { CNY: "¥", USD: "$" };

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

		/** 宿主返回的是错误码；本地化后再显示，认不出的码退回宿主给的原文。 */
		function errorText(result) {
			if (!result) return t("opFailed");
			if (result.code) {
				const key = `err.${result.code}`;
				const text = t(key);
				if (text !== key) return text;
			}
			return result.error || t("opFailed");
		}

		/** 把宿主返回的余额条目格式化成一行文字；失败就说失败，不装作没数据。 */
		function moneyTextOf(entry) {
			if (!entry) return "";
			if (!entry.ok) return entry.error ? `⚠ ${entry.error}` : t("queryFailed");
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
			// 用 id 前缀定位更稳：不同语言下这一行的文字不一样。
			setTimeout(() => {
				try {
					const dialog = document.querySelector('[role="dialog"]');
					if (!dialog) return;
					const buttons = Array.from(dialog.querySelectorAll("button"));
					const ours = buttons.find((button) => /^API Key (管理|Manager|キー管理|키 관리|Управление)/.test((button.textContent || "").trim()));
					if (ours) ours.click();
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

		/** 16px 描边钥匙图标：线宽和官方 16px 图标一致，颜色跟随 currentColor。 */
		function KeyIcon() {
			return h("svg", {
				width: 16, height: 16, viewBox: "0 0 16 16", fill: "none",
				className: "ksw-entry-icon", "aria-hidden": true
			},
				h("circle", { cx: 5.9, cy: 5.9, r: 3.35, stroke: "currentColor", strokeWidth: 1.3 }),
				h("path", { d: "M8.35 8.35 13.3 13.3", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" }),
				h("path", { d: "M11.3 11.3 12.6 10", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" })
			);
		}

		/** 侧边栏底部入口：实时余额 + 点击展开切换面板。 */
		function QuotaEntry() {
			const snapshot = useStore();
			React.useEffect(() => {
				ensurePolling();
				if (!snapshot.ready && !snapshot.busy) refreshStore(false);
			}, []);

			const text = activeBalanceText(snapshot);
			const keys = ((snapshot.providers || [])[0] || {}).keys || [];
			const label = snapshot.error
				? t("entryUnavailable")
				: text || (snapshot.ready ? t("entryEmpty") : t("loading"));

			return h("button", {
				className: "ksw-entry",
				type: "button",
				title: keys.length ? t("entryTitleCount", { count: keys.length }) : t("entryTitle"),
				onClick: () => {
					store.open = !store.open;
					emit();
					if (store.open) refreshStore(false);
				}
			}, h(KeyIcon, null), h("span", { className: "ksw-entry-text" }, label));
		}

		/** 点击入口后弹出的面板（挂在 shell.overlay 上，不会被侧边栏裁切）。 */
		function KeyPanel() {
			const snapshot = useStore();
			if (!snapshot.open) return null;

			const provider = (snapshot.providers || [])[0];
			const keys = (provider && provider.keys) || [];

			async function activate(keyId) {
				store.busy = true;
				emit();
				try {
					const result = await call("activate", { providerId: provider.providerId, id: keyId });
					store.error = result && result.ok === false ? errorText(result) : "";
				} catch (error) {
					store.error = t("requestFailed", { message: error && error.message ? error.message : String(error) });
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
				onClick: () => { if (!key.active) activate(key.id); }
			},
				h("span", { className: "ksw-item-note" }, key.note || t("noNote")),
				h("span", { className: "ksw-item-mask ksw-mono" }, key.masked),
				h("span", { className: "ksw-item-bal" }, moneyTextOf(snapshot.balances[key.id]) || "—"),
				key.active ? h("span", { className: "ksw-badge" }, t("inUse")) : null
			));

			return h("div", { className: "ksw-layer" },
				h("div", { className: "ksw-backdrop", onClick: () => { store.open = false; emit(); } }),
				h("div", { className: "ksw-pop", role: "dialog", "aria-label": t("title") },
					h("div", { className: "ksw-pop-head" },
						h("span", { className: "ksw-pop-title" }, t("title")),
						h("span", { className: "ksw-hint" }, snapshot.at ? t("updatedAt", { time: timeTextOf(snapshot.at) }) : "")
					),
					rows.length ? h("div", { className: "ksw-pop-list" }, rows) : h("div", { className: "ksw-sub" }, t("poolEmpty")),
					snapshot.error ? h("div", { className: "ksw-msg err" }, snapshot.error) : null,
					h("div", { className: "ksw-pop-foot" },
						h("button", { className: "ksw-btn", type: "button", disabled: snapshot.busy, onClick: () => refreshStore(true) }, t("refreshBalance")),
						h("button", { className: "ksw-btn primary", type: "button", onClick: openSettings }, t("manage"))
					)
				)
			);
		}

		function KeySwitchPage() {
			const [state, setState] = React.useState({ loading: true, providers: [], balances: {}, balanceAt: 0 });
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
					flash(t("loadFailed", { message: error && error.message ? error.message : String(error) }), "err");
				}
			}

			React.useEffect(() => { load(); }, []);

			/** 绕过 60 秒缓存重新查一遍余额。 */
			async function refreshBalances() {
				setBusy(true);
				try {
					const result = await call("balances?fresh=1");
					setState((current) => ({ ...current, balances: (result && result.results) || {}, balanceAt: (result && result.at) || Date.now() }));
					flash(t("balanceRefreshed"));
				} catch (error) {
					flash(t("balanceRefreshFailed", { message: error && error.message ? error.message : String(error) }), "err");
				} finally {
					setBusy(false);
				}
			}

			async function run(action, payload, okText) {
				setBusy(true);
				try {
					const result = await action(payload);
					if (!result || result.ok === false) {
						flash(errorText(result), "err");
						return false;
					}
					flash(okText);
					await load();
					return true;
				} catch (error) {
					flash(t("requestFailed", { message: error && error.message ? error.message : String(error) }), "err");
					return false;
				} finally {
					setBusy(false);
				}
			}

			async function addKey(providerId) {
				const form = formOf(providerId);
				const value = String(form.value || "").trim();
				if (!value) {
					flash(t("needKey"), "err");
					return;
				}
				const ok = await run((p) => call("add", p), { providerId, note: form.note, value }, t("added"));
				if (ok) setForm(providerId, { value: "", note: "" });
			}

			function renderProvider(provider) {
				const balances = state.balances || {};
				const balanceOf = (keyId) => moneyTextOf(balances[keyId]);

				const rows = (provider.keys || []).map((key) => h("div", { className: "ksw-row", key: key.id },
					h("span", { className: key.note ? "ksw-note" : "ksw-note empty" }, key.note || t("noNote")),
					h("span", { className: "ksw-mono" }, key.masked),
					h("span", { className: "ksw-balance" }, balanceOf(key.id) || "—"),
					key.active
						? h("span", { className: "ksw-badge" }, t("inUse"))
						: h("button", {
							className: "ksw-btn",
							type: "button",
							disabled: busy,
							onClick: () => run((p) => call("activate", p), { providerId: provider.providerId, id: key.id }, t("activated", { mask: key.masked }))
						}, t("use")),
					h("button", {
						className: "ksw-btn danger",
						type: "button",
						disabled: busy,
						onClick: () => run((p) => call("remove", p), { providerId: provider.providerId, id: key.id }, t("removed"))
					}, t("remove"))
				));

				const activeKey = (provider.keys || []).find((key) => key.active);
				const liveBalance = activeKey ? balanceOf(activeKey.id) : moneyTextOf(balances[`live:${provider.ref}`]);

				const form = formOf(provider.providerId);

				return h("div", { className: "ksw-block", key: provider.providerId },
					h("div", { className: "ksw-blockHead" },
						h("span", { className: "ksw-prov" }, provider.displayName || provider.providerId),
						h("span", { className: "ksw-ref" }, t("ref", { ref: provider.ref || "—" })),
						liveBalance ? h("span", { className: "ksw-balance big" }, liveBalance) : null
					),
					h("div", { className: "ksw-live" },
						h("span", { className: "ksw-liveLabel" }, t("current")),
						h("span", { className: "ksw-mono" }, provider.liveMasked || t("noLive")),
						liveBalance ? h("span", { className: "ksw-balance" }, liveBalance) : null,
						provider.liveMasked && !provider.liveInPool
							? h("span", { className: "ksw-sub" }, t("notInPool"))
							: null
					),
					provider.shadowedByEnv
						? h("div", { className: "ksw-sub" }, t("envShadow", { ref: provider.ref }))
						: null,
					(rows.length ? h("div", { className: "ksw-rows" }, rows) : h("div", { className: "ksw-sub" }, t("poolEmpty"))),
					h("div", { className: "ksw-form" },
						h("label", { className: "ksw-label" }, t("addKey")),
						h("input", {
							className: "ksw-input",
							// 故意用 text 而不是 password：密码框会招来密码管理器和部分扩展的浮层，
							// 那个浮层会抢走焦点，输入会中断。
							type: "text",
							autoComplete: "off",
							spellCheck: false,
							placeholder: t("keyPlaceholder"),
							value: form.value,
							onChange: (event) => setForm(provider.providerId, { value: event.target.value })
						}),
						h("input", {
							className: "ksw-input",
							autoComplete: "off",
							placeholder: t("notePlaceholder"),
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
							}, t("add"))
						)
					)
				);
			}

			const providers = state.providers || [];
			const body = [];

			body.push(h("div", { className: "ksw-head", key: "head" },
				h("h3", { className: "ksw-title" }, t("title")),
				h("div", { className: "ksw-sub" }, t("subtitle"))
			));

			if (state.loading) {
				body.push(h("div", { className: "ksw-sub", key: "loading" }, t("loading")));
			} else if (!providers.length) {
				body.push(h("div", { className: "ksw-sub", key: "empty" }, t("noProvider")));
			} else {
				providers.forEach((provider) => body.push(renderProvider(provider)));
			}

			// 手动重试：浏览器到本机的连接被占满时请求会排队，关掉多余的 DSH 标签页再点它。
			body.push(h("div", { className: "ksw-actions", key: "reload" },
				state.balanceAt ? h("span", { className: "ksw-hint" }, t("balanceUpdatedAt", { time: timeTextOf(state.balanceAt) })) : null,
				h("button", { className: "ksw-btn", type: "button", disabled: busy, onClick: refreshBalances }, t("refreshBalance")),
				h("button", { className: "ksw-btn", type: "button", disabled: busy, onClick: () => { flash(""); load(); } }, t("reload"))
			));

			if (msg) body.push(h("div", { className: `ksw-msg${msgKind === "err" ? " err" : ""}`, key: "msg" }, msg));

			return h("div", { className: "ksw" }, body);
		}

		//#region 设置导航图标

		/**
		 * 宿主给设置分区画图标时只看 section id（models / agent-presets / plugins），
		 * 其余一律回落到齿轮——注册时没有图标字段可传。所以这里在我们自己那一行上
		 * 把齿轮换成钥匙：只动我们自己的按钮，且保留宿主原有的 class，
		 * 让尺寸、颜色继续跟着主题走。宿主重渲染会还原，靠 MutationObserver 补回来。
		 */
		const NAV_ICON_FLAG = "data-ksw-nav-icon";
		const SVG_NS = "http://www.w3.org/2000/svg";

		function createKeySvg(className) {
			const svg = document.createElementNS(SVG_NS, "svg");
			svg.setAttribute("width", "16");
			svg.setAttribute("height", "16");
			svg.setAttribute("viewBox", "0 0 16 16");
			svg.setAttribute("fill", "none");
			svg.setAttribute("aria-hidden", "true");
			if (className) svg.setAttribute("class", className);
			svg.setAttribute(NAV_ICON_FLAG, "");

			const circle = document.createElementNS(SVG_NS, "circle");
			circle.setAttribute("cx", "5.9");
			circle.setAttribute("cy", "5.9");
			circle.setAttribute("r", "3.35");
			circle.setAttribute("stroke", "currentColor");
			circle.setAttribute("stroke-width", "1.3");

			const shaft = document.createElementNS(SVG_NS, "path");
			shaft.setAttribute("d", "M8.35 8.35 13.3 13.3");
			shaft.setAttribute("stroke", "currentColor");
			shaft.setAttribute("stroke-width", "1.3");
			shaft.setAttribute("stroke-linecap", "round");

			const tooth = document.createElementNS(SVG_NS, "path");
			tooth.setAttribute("d", "M11.3 11.3 12.6 10");
			tooth.setAttribute("stroke", "currentColor");
			tooth.setAttribute("stroke-width", "1.3");
			tooth.setAttribute("stroke-linecap", "round");

			svg.append(circle, shaft, tooth);
			return svg;
		}

		/** 把我们那一行的导航图标换成钥匙；已经换过就什么都不做。 */
		function paintNavIcon() {
			if (typeof document === "undefined") return;
			const dialog = document.querySelector('[role="dialog"]');
			if (!dialog) return;
			const label = t("title");
			for (const button of dialog.querySelectorAll("button")) {
				if ((button.textContent || "").trim() !== label) continue;
				if (button.querySelector(`svg[${NAV_ICON_FLAG}]`)) return;
				const current = button.querySelector("svg");
				if (!current) return;
				current.replaceWith(createKeySvg(current.getAttribute("class")));
				return;
			}
		}

		/** 设置弹窗随时挂载/重渲染，盯着 DOM 补图标。返回 disposer。 */
		function patchNavIcon() {
			if (typeof document === "undefined" || typeof MutationObserver !== "function") return () => {};
			let queued = false;
			let stopped = false;
			const schedule = () => {
				if (queued || stopped) return;
				queued = true;
				const run = () => {
					queued = false;
					paintNavIcon();
				};
				if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
				else setTimeout(run, 16);
			};
			const observer = new MutationObserver(schedule);
			observer.observe(document.body, { childList: true, subtree: true });
			schedule();
			return () => {
				stopped = true;
				observer.disconnect();
			};
		}

		//#endregion

		const name = "dsh-key-switch";
		const inject = ["slots", "locale"];

		/** 除内置 zh / en 之外，插件自己注册的可选语言。 */
		const EXTRA_LANGUAGES = [
			{ id: "zh-Hant", label: "繁體中文", fallback: "zh", dict: zhHant },
			{ id: "ja", label: "日本語", fallback: "en", dict: ja },
			{ id: "ko", label: "한국어", fallback: "en", dict: ko },
			{ id: "ru", label: "Русский", fallback: "en", dict: ru }
		];

		function apply(ctx) {
			installStyles();

			ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${NS}: built-in dictionaries`);
			EXTRA_LANGUAGES.forEach((language) => {
				ctx.effect(
					() => ctx.locale.addLanguage({ id: language.id, label: language.label, fallback: language.fallback }),
					`${NS}: ${language.id} language`
				);
				ctx.effect(
					() => ctx.locale.register(NS, language.id, language.dict),
					`${NS}: ${language.id} dictionary`
				);
			});

			t = ctx.locale.bind(NS);
			ctx.effect(() => patchNavIcon(), `${NS}: settings nav icon`);

			ctx.slots.inject("settings.section", () =>
				ctx.slots.register(
					{
						name: "settings.section",
						id: "key-switch",
						order: SECTION_ORDER,
						label: () => t("title"),
						locale: NS
					},
					() => h(KeySwitchPage, null)
				)
			);
			ctx.slots.inject("sidebar.footer.action", () =>
				ctx.slots.register(
					{
						name: "sidebar.footer.action",
						id: "key-switch-entry",
						order: 8,
						locale: NS
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
						label: () => t("title"),
						locale: NS
					},
					() => h(KeyPanel, null)
				)
			);
		}

		module.exports = { name, inject, apply };
		return module.exports;
	}
});
