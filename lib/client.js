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
			trend: "余额趋势",
			range24h: "24 小时",
			range7d: "7 天",
			range30d: "30 天",
			todaySpend: "今日已花",
			burnPerDay: "日均消耗",
			daysLeft: "预计可用",
			daysValue: "{n} 天",
			samplesCount: "{n} 个采样点",
			noHistory: "还没有样本。每次查询余额时记一点，用一会儿就有曲线了。",
			autoTitle: "自动策略",
			autoSwitch: "余额不足时自动切换",
			autoSwitchDesc: "当前 key 余额低于阈值时，自动切到同币种里余额最多的那一把",
			threshold: "阈值",
			thresholdHint: "所有币种共用这个数值",
			autoBalance: "按权重均衡消耗",
			autoBalanceDesc: "比较每个账号“消耗掉自身余额的比例”，让用得少的优先；权重越大越晚被换下",
			weight: "权重",
			tolerance: "容差",
			toleranceUnit: "个百分点",
			save: "保存",
			saved: "已保存",
			lastAction: "上次自动切换：{from} → {to}（{reason}）",
			reasonThreshold: "余额不足",
			reasonBalance: "均衡消耗",
			policyOff: "两个开关都关着，插件只显示，不会动你的 key。",
			advanced: "高级设置",
			spendTitle: "会话消耗",
			rangeToday: "今天",
			range7d: "7 天",
			range30d: "30 天",
			colTotal: "合计",
			segName: "{a}–{b} 时",
			noPrices: "只统计 token。在下面填了单价后，这里会显示金额。",
			pricesTitle: "单价（元 / 百万 token）",
			priceIn: "输入",
			priceHit: "命中",
			priceOut: "输出",
			pricePeak: "高峰",
			priceOff: "低谷",
			savePrices: "保存单价",
			noSessions: "这段时间没有调用记录。",
			groupSession: "会话",
			groupWorkspace: "工作区",
			groupModel: "模型",
			show: "显示",
			hide: "隐藏",
			copy: "复制",
			copied: "已复制到剪贴板",
			revealFailed: "读不到这把密钥",
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
			trend: "Balance trend",
			range24h: "24h",
			range7d: "7d",
			range30d: "30d",
			todaySpend: "Spent today",
			burnPerDay: "Daily burn",
			daysLeft: "Days left",
			daysValue: "{n} days",
			samplesCount: "{n} samples",
			noHistory: "No samples yet. One point is recorded each time a balance is fetched.",
			autoTitle: "Automation",
			autoSwitch: "Switch when the balance runs low",
			autoSwitchDesc: "When the active key drops below the threshold, switch to the richest key in the same currency",
			threshold: "Threshold",
			thresholdHint: "one value for all currencies",
			autoBalance: "Balance spend by weight",
			autoBalanceDesc: "Compares how much of each account’s own balance it has burned, so less-used accounts go first; a higher weight keeps a key longer",
			weight: "Weight",
			tolerance: "Tolerance",
			toleranceUnit: "points",
			save: "Save",
			saved: "Saved",
			lastAction: "Last automatic switch: {from} → {to} ({reason})",
			reasonThreshold: "low balance",
			reasonBalance: "evening spend",
			policyOff: "Both switches are off — the plugin only displays, it never touches your keys.",
			advanced: "Advanced",
			spendTitle: "Session spend",
			rangeToday: "Today",
			range7d: "7 days",
			range30d: "30 days",
			colTotal: "Total",
			segName: "{a}–{b}h",
			noPrices: "Tokens only. Fill in unit prices below to see money here.",
			pricesTitle: "Unit price (CNY / 1M tokens)",
			priceIn: "Input",
			priceHit: "Cached",
			priceOut: "Output",
			pricePeak: "Peak",
			priceOff: "Off-peak",
			savePrices: "Save prices",
			noSessions: "No calls in this period.",
			groupSession: "Session",
			groupWorkspace: "Workspace",
			groupModel: "Model",
			show: "Show",
			hide: "Hide",
			copy: "Copy",
			copied: "Copied to clipboard",
			revealFailed: "Could not read this key",
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
			trend: "餘額趨勢",
			range24h: "24 小時",
			range7d: "7 天",
			range30d: "30 天",
			todaySpend: "今日已花",
			burnPerDay: "日均消耗",
			daysLeft: "預計可用",
			daysValue: "{n} 天",
			samplesCount: "{n} 個取樣點",
			noHistory: "還沒有樣本。每次查詢餘額時記一點，用一會兒就有曲線了。",
			autoTitle: "自動策略",
			autoSwitch: "餘額不足時自動切換",
			autoSwitchDesc: "目前 key 餘額低於閾值時，自動切到同幣種裡餘額最多的那把",
			threshold: "閾值",
			thresholdHint: "所有幣種共用這個數值",
			autoBalance: "依權重均衡消耗",
			autoBalanceDesc: "比較每個帳號「消耗掉自身餘額的比例」，讓用得少的優先；權重越大越晚被換下",
			weight: "權重",
			tolerance: "容差",
			toleranceUnit: "個百分點",
			save: "儲存",
			saved: "已儲存",
			lastAction: "上次自動切換：{from} → {to}（{reason}）",
			reasonThreshold: "餘額不足",
			reasonBalance: "均衡消耗",
			policyOff: "兩個開關都關著，外掛只顯示，不會動你的 key。",
			advanced: "進階設定",
			spendTitle: "會話消耗",
			rangeToday: "今天",
			range7d: "7 天",
			range30d: "30 天",
			colTotal: "合計",
			segName: "{a}–{b} 時",
			noPrices: "只統計 token。在下面填入單價後，這裡會顯示金額。",
			pricesTitle: "單價（元 / 百萬 token）",
			priceIn: "輸入",
			priceHit: "命中",
			priceOut: "輸出",
			pricePeak: "高峰",
			priceOff: "低谷",
			savePrices: "儲存單價",
			noSessions: "這段時間沒有呼叫記錄。",
			groupSession: "會話",
			groupWorkspace: "工作區",
			groupModel: "模型",
			show: "顯示",
			hide: "隱藏",
			copy: "複製",
			copied: "已複製到剪貼簿",
			revealFailed: "讀不到這把金鑰",
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
			trend: "残高の推移",
			range24h: "24 時間",
			range7d: "7 日",
			range30d: "30 日",
			todaySpend: "本日の消費",
			burnPerDay: "1 日あたり",
			daysLeft: "残り日数",
			daysValue: "{n} 日",
			samplesCount: "{n} サンプル",
			noHistory: "サンプルはまだありません。残高を取得するたびに 1 点記録されます。",
			autoTitle: "自動ポリシー",
			autoSwitch: "残高不足なら自動切替",
			autoSwitchDesc: "有効なキーの残高がしきい値を下回ると、同じ通貨で最も残高が多いキーに切り替えます",
			threshold: "しきい値",
			thresholdHint: "すべての通貨で共通の値",
			autoBalance: "重みで消費を平準化",
			autoBalanceDesc: "各アカウントが「自身の残高のうち何割を使ったか」を比べ、使っていないアカウントを優先します。重みが大きいほど切り替えられにくくなります",
			weight: "重み",
			tolerance: "許容差",
			toleranceUnit: "ポイント",
			save: "保存",
			saved: "保存しました",
			lastAction: "前回の自動切替：{from} → {to}（{reason}）",
			reasonThreshold: "残高不足",
			reasonBalance: "消費の平準化",
			policyOff: "両方オフのため、表示のみでキーは変更しません。",
			advanced: "詳細設定",
			spendTitle: "セッション消費",
			rangeToday: "今日",
			range7d: "7 日",
			range30d: "30 日",
			colTotal: "合計",
			segName: "{a}–{b} 時",
			noPrices: "トークンのみ。下に単価を入れると金額が表示されます。",
			pricesTitle: "単価（元 / 100 万トークン）",
			priceIn: "入力",
			priceHit: "キャッシュ",
			priceOut: "出力",
			pricePeak: "ピーク",
			priceOff: "オフピーク",
			savePrices: "単価を保存",
			noSessions: "この期間の呼び出しはありません。",
			groupSession: "セッション",
			groupWorkspace: "ワークスペース",
			groupModel: "モデル",
			show: "表示",
			hide: "隠す",
			copy: "コピー",
			copied: "クリップボードにコピーしました",
			revealFailed: "キーを読み取れません",
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
			trend: "잔액 추이",
			range24h: "24시간",
			range7d: "7일",
			range30d: "30일",
			todaySpend: "오늘 사용",
			burnPerDay: "일 평균",
			daysLeft: "남은 일수",
			daysValue: "{n}일",
			samplesCount: "샘플 {n}개",
			noHistory: "아직 샘플이 없습니다. 잔액을 조회할 때마다 한 점씩 기록됩니다.",
			autoTitle: "자동 정책",
			autoSwitch: "잔액 부족 시 자동 전환",
			autoSwitchDesc: "현재 키의 잔액이 기준값 아래로 떨어지면 같은 통화에서 잔액이 가장 많은 키로 전환합니다",
			threshold: "기준값",
			thresholdHint: "모든 통화에 같은 값 적용",
			autoBalance: "가중치로 소비 균형",
			autoBalanceDesc: "각 계정이 자기 잔액 대비 얼마나 썼는지를 비교해 덜 쓴 계정을 먼저 사용합니다. 가중치가 클수록 늦게 전환됩니다",
			weight: "가중치",
			tolerance: "허용 오차",
			toleranceUnit: "포인트",
			save: "저장",
			saved: "저장했습니다",
			lastAction: "최근 자동 전환: {from} → {to} ({reason})",
			reasonThreshold: "잔액 부족",
			reasonBalance: "소비 균형",
			policyOff: "두 스위치가 모두 꺼져 있어 표시만 하고 키를 바꾸지 않습니다.",
			advanced: "고급 설정",
			spendTitle: "세션 소비",
			rangeToday: "오늘",
			range7d: "7일",
			range30d: "30일",
			colTotal: "합계",
			segName: "{a}–{b}시",
			noPrices: "토큰만 집계합니다. 아래에 단가를 입력하면 금액이 표시됩니다.",
			pricesTitle: "단가 (위안 / 100만 토큰)",
			priceIn: "입력",
			priceHit: "캐시",
			priceOut: "출력",
			pricePeak: "피크",
			priceOff: "비피크",
			savePrices: "단가 저장",
			noSessions: "이 기간에 호출이 없습니다.",
			groupSession: "세션",
			groupWorkspace: "워크스페이스",
			groupModel: "모델",
			show: "표시",
			hide: "숨기기",
			copy: "복사",
			copied: "클립보드에 복사했습니다",
			revealFailed: "키를 읽을 수 없습니다",
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
			trend: "Динамика баланса",
			range24h: "24 ч",
			range7d: "7 дн",
			range30d: "30 дн",
			todaySpend: "Потрачено сегодня",
			burnPerDay: "В день",
			daysLeft: "Хватит на",
			daysValue: "{n} дн",
			samplesCount: "Точек: {n}",
			noHistory: "Точек пока нет. Одна записывается при каждом запросе баланса.",
			autoTitle: "Автоматизация",
			autoSwitch: "Переключать при низком балансе",
			autoSwitchDesc: "Когда баланс активного ключа падает ниже порога, переключиться на ключ с наибольшим балансом в той же валюте",
			threshold: "Порог",
			thresholdHint: "одно значение для всех валют",
			autoBalance: "Выравнивать расход по весам",
			autoBalanceDesc: "Сравнивает, какую долю собственного баланса израсходовал каждый аккаунт: менее израсходованные идут первыми; больший вес дольше удерживает ключ",
			weight: "Вес",
			tolerance: "Допуск",
			toleranceUnit: "пунктов",
			save: "Сохранить",
			saved: "Сохранено",
			lastAction: "Последнее автопереключение: {from} → {to} ({reason})",
			reasonThreshold: "низкий баланс",
			reasonBalance: "выравнивание",
			policyOff: "Оба переключателя выключены — плагин только показывает данные.",
			advanced: "Дополнительно",
			spendTitle: "Расход по сессиям",
			rangeToday: "Сегодня",
			range7d: "7 дней",
			range30d: "30 дней",
			colTotal: "Итого",
			segName: "{a}–{b} ч",
			noPrices: "Показаны только токены. Укажите цены ниже, чтобы видеть суммы.",
			pricesTitle: "Цена (CNY / 1 млн токенов)",
			priceIn: "Вход",
			priceHit: "Кэш",
			priceOut: "Выход",
			pricePeak: "Пик",
			priceOff: "Вне пика",
			savePrices: "Сохранить цены",
			noSessions: "За этот период вызовов нет.",
			groupSession: "Сессия",
			groupWorkspace: "Рабочая область",
			groupModel: "Модель",
			show: "Показать",
			hide: "Скрыть",
			copy: "Копировать",
			copied: "Скопировано",
			revealFailed: "Не удалось прочитать ключ",
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

/* 高级设置折叠区 */
.ksw-adv{display:flex;align-items:center;justify-content:space-between;width:100%;height:32px;padding:0 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:var(--dsw-font-xs-13,13px/20px inherit);cursor:pointer}
.ksw-adv:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.ksw-advOpen{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,inherit)}
.ksw-advCaret{transition:transform .15s ease}
.ksw-advCaret.open{transform:rotate(180deg)}
.ksw-advBody{display:flex;flex-direction:column;gap:12px}

.ksw-iconBtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.38));background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer}
.ksw-iconBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,inherit)}
.ksw-iconBtn:disabled{opacity:.4;cursor:default}
.ksw-rawKey{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dsw-font-markdown-code-font-family,monospace);font-size:11.5px;color:var(--dsw-alias-label-primary,inherit)}

.ksw-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:200;padding:8px 16px;border-radius:999px;border:1px solid var(--dsw-elevation-stroke-color,var(--dsw-alias-border-l2,rgba(127,127,127,.3)));background:var(--dsw-alias-bg-layer-3,#2b2c30);color:var(--dsw-alias-label-primary,inherit);box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(0,0,0,.35));font:var(--dsw-font-xs-13,13px/20px inherit);white-space:nowrap;pointer-events:none}
.ksw-toast.err{color:var(--dsw-alias-state-error-primary,#e06c6c)}

/* 分段切换（一个胶囊里切档，参考官方用量页） */
.ksw-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.ksw-segItem{height:24px;padding:0 10px;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:var(--dsw-font-xxs-12,12px/18px inherit);cursor:pointer;white-space:nowrap}
.ksw-segItem:hover{color:var(--dsw-alias-label-primary,inherit)}
.ksw-segItem.active{background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#2f3033));color:var(--dsw-alias-label-primary,inherit);box-shadow:var(--dsw-shadow-lv3,0 1px 3px rgba(0,0,0,.25))}

/* 会话消耗表 */
.ksw-table{display:flex;flex-direction:column;gap:2px}
.ksw-tr{display:flex;align-items:center;gap:8px;padding:4px 0}
.ksw-th{color:var(--dsw-alias-label-caption,inherit);font:var(--dsw-font-xxxs-11,11px/14px inherit)}
.ksw-td{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ksw-td.name{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-primary,inherit)}
.ksw-td.num{flex:0 0 auto;min-width:64px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,inherit)}
.ksw-td.num.strong{color:var(--dsw-alias-label-primary,inherit);font-weight:600}
.ksw-priceRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ksw-priceName{font-family:var(--dsw-font-markdown-code-font-family,monospace);min-width:120px;color:var(--dsw-alias-label-secondary,inherit)}
.ksw-num.small{width:56px}

/* 图表悬停 */
.ksw-chartWrap{position:relative;width:100%}
.ksw-guide{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l3,rgba(127,127,127,.45));pointer-events:none}
.ksw-dot{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#4aa46b);pointer-events:none}
.ksw-tip{position:absolute;transform:translate(-50%,-130%);padding:5px 8px;border-radius:8px;border:1px solid var(--dsw-elevation-stroke-color,var(--dsw-alias-border-l2,rgba(127,127,127,.3)));background:var(--dsw-tooltip-bg,var(--dsw-alias-bg-layer-3,#2a2b2e));color:var(--dsw-alias-label-primary,inherit);box-shadow:var(--dsw-shadow-lv3,0 6px 18px rgba(0,0,0,.25));font:var(--dsw-font-xxxs-11,11px/14px inherit);white-space:nowrap;pointer-events:none;z-index:2}
.ksw-tip.flip{transform:translate(-100%,-130%)}
.ksw-tipTime{color:var(--dsw-alias-label-caption,inherit);margin-right:6px}
.ksw-tipValue{font-variant-numeric:tabular-nums}

/* 自动策略 */
.ksw-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--dsw-alias-label-primary,inherit)}
.ksw-toggle input{width:14px;height:14px;accent-color:var(--dsw-alias-brand-primary,#6b8cff);cursor:pointer}
.ksw-num{width:92px;height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.38));background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);font:var(--dsw-font-xs-13,13px/20px inherit);box-sizing:border-box}
.ksw-num:focus{outline:none;border-color:var(--dsw-alias-brand-primary,rgba(127,127,127,.6))}
.ksw-field{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ksw-weightRow{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ksw-weightName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,inherit)}

/* 余额趋势 */
.ksw-card{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-bg-layer-2,transparent)}
.ksw-cardHead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ksw-cardTitle{font:var(--dsw-font-xs-strong-13,600 13px/20px inherit);color:var(--dsw-alias-label-primary,inherit)}
.ksw-ranges{display:flex;gap:4px}
.ksw-range{height:24px;padding:0 10px;border-radius:999px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:var(--dsw-font-xxs-12,12px/18px inherit);cursor:pointer}
.ksw-range:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.ksw-range.active{background:var(--dsw-alias-interactive-bg-active,rgba(127,127,127,.18));color:var(--dsw-alias-label-primary,inherit)}
.ksw-stats{display:flex;gap:20px;flex-wrap:wrap}
.ksw-stat{display:flex;flex-direction:column;gap:2px;min-width:0}
.ksw-statLabel{font:var(--dsw-font-xxxs-11,11px/14px inherit);color:var(--dsw-alias-label-caption,inherit)}
.ksw-statValue{font:var(--dsw-font-xs-strong-13,600 13px/20px inherit);color:var(--dsw-alias-label-primary,inherit);font-variant-numeric:tabular-nums;white-space:nowrap}
.ksw-chart{width:100%;height:120px;display:block;overflow:visible}
.ksw-grid{stroke:var(--dsw-alias-border-l2,rgba(127,127,127,.22));stroke-width:1;fill:none}
.ksw-line{stroke:var(--dsw-alias-state-success-primary,#4aa46b);stroke-width:1.8;fill:none;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.ksw-axis{font:var(--dsw-font-xxxs-11,11px/14px inherit);fill:var(--dsw-alias-label-caption,#8a8a8a)}
.ksw-spark{width:56px;height:16px;flex:0 0 auto;opacity:.9}
.ksw-sparkLine{stroke:var(--dsw-alias-state-success-primary,#4aa46b);stroke-width:1.4;fill:none;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.ksw-legend{font:var(--dsw-font-xxxs-11,11px/14px inherit);color:var(--dsw-alias-label-caption,inherit)}

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

		/** 气泡里的时间：MM-DD HH:mm。 */
		function stampOf(ms) {
			const date = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
			series: {},
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
				let series = {};
				try {
					const history = await call("history?range=24h");
					series = (history && history.series) || {};
				} catch (error) {
					series = {};
				}
				store.providers = (state && state.providers) || [];
				store.balances = balances;
				store.series = series;
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

		/** 眼睛 / 复制的小图标。 */
		function EyeIcon(props) {
			const off = props && props.off;
			return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
				h("path", { d: "M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z", stroke: "currentColor", strokeWidth: 1.2 }),
				h("circle", { cx: 8, cy: 8, r: 2, stroke: "currentColor", strokeWidth: 1.2 }),
				off ? h("path", { d: "M2.5 13.5 13.5 2.5", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" }) : null
			);
		}

		function CheckIcon() {
			return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
				h("path", { d: "M3 8.5 6.2 11.7 13 4.9", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })
			);
		}

		function CopyIcon() {
			return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
				h("rect", { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.6, stroke: "currentColor", strokeWidth: 1.2 }),
				h("path", { d: "M10.5 3.5H4.1A1.6 1.6 0 0 0 2.5 5.1v6.4", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" })
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
				h(Sparkline, { points: snapshot.series[key.id] }),
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

		/**
		 * 把样本点画成阶梯路径：余额是阶梯函数（花钱才跳一下），
		 * 所以水平走完一段时间再垂直落下一档，比斜线更如实。
		 * 采样断档（间隔超过中位数的 3 倍）时断开，不连一条假线。
		 */
		function buildStepPath(points, width, height, pad) {
			const ok = (points || []).filter((point) => point.ok !== false && point.v !== undefined);
			if (ok.length < 2) return null;
			const values = ok.map((point) => Number(point.v));
			let min = Math.min(...values);
			let max = Math.max(...values);
			if (min === max) {
				min -= 1;
				max += 1;
			}
			const t0 = ok[0].t;
			const t1 = ok[ok.length - 1].t;
			const span = Math.max(1, t1 - t0);
			const x = (t) => pad + ((t - t0) / span) * (width - pad * 2);
			const y = (v) => pad + (1 - (v - min) / (max - min)) * (height - pad * 2);

			const gaps = [];
			for (let i = 1; i < ok.length; i += 1) gaps.push(ok[i].t - ok[i - 1].t);
			gaps.sort((a, b) => a - b);
			const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : Number.POSITIVE_INFINITY;
			const gapLimit = Math.max(median * 3, 1000);

			let d = `M ${x(ok[0].t).toFixed(1)} ${y(values[0]).toFixed(1)}`;
			for (let i = 1; i < ok.length; i += 1) {
				const px = x(ok[i].t).toFixed(1);
				const previousY = y(values[i - 1]).toFixed(1);
				const currentY = y(values[i]).toFixed(1);
				if (ok[i].t - ok[i - 1].t > gapLimit) {
					d += ` M ${px} ${currentY}`;
					continue;
				}
				d += ` L ${px} ${previousY} L ${px} ${currentY}`;
			}
			return {
				d, min, max,
				first: values[0],
				last: values[values.length - 1],
				/** 归一化到 0..1，前端据此算百分比定位。 */
				xFrac: (t) => Math.min(1, Math.max(0, (t - t0) / span)),
				yFrac: (v) => 1 - (Number(v) - min) / (max - min)
			};
		}

		/** 弹层每行的小折线（24 小时）。点太少就不画，避免看起来像 0。 */
		function Sparkline(props) {
			const geometry = buildStepPath(props.points, 56, 16, 1);
			if (!geometry) return null;
			return h("svg", { className: "ksw-spark", viewBox: "0 0 56 16", "aria-hidden": true },
				h("path", { className: "ksw-sparkLine", d: geometry.d })
			);
		}

		/** token 数的紧凑写法：1.2M / 92.7k / 3.1B。 */
		function fmtTokens(value) {
			const n = Number(value) || 0;
			if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
			if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
			if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
			return String(n);
		}

		/** 会话消耗卡：会话 × 时段（默认 8 小时一段），有价目时显示金额。 */
		function SpendCard(props) {
			const { report, range, onRange, onGroup, prices, onSavePrices, busy } = props;
			const [draft, setDraft] = React.useState(prices || {});
			React.useEffect(() => { setDraft(prices || {}); }, [prices]);

			const rows = (report && report.rows) || [];
			const segments = (report && report.segments) || 3;
			const hours = (report && report.segmentHours) || 8;
			const models = (report && report.models) || [];
			const ranges = ["today", "7d", "30d"];
			const rangeLabels = { today: t("rangeToday"), "7d": t("range7d"), "30d": t("range30d") };
			const groups = ["session", "workspace", "model"];
			const groupLabels = { session: t("groupSession"), workspace: t("groupWorkspace"), model: t("groupModel") };
			const activeGroup = props.group || "session";

			const cellText = (cell, priced) => (priced ? "¥" + Number(cell.cost).toFixed(2) : fmtTokens(cell.input + cell.cacheRead + cell.output));
			const totalOf = (row) => (row.priced ? "¥" + Number(row.cost).toFixed(2) : fmtTokens(row.input + row.cacheRead + row.output));

			const setRate = (model, phase, field, value) => {
				const next = { ...draft };
				const entry = { peak: {}, offpeak: {}, ...(next[model] || {}) };
				entry[phase] = { ...(entry[phase] || {}), [field]: Number(value) };
				next[model] = entry;
				setDraft(next);
			};
			const rateOf = (model, phase, field) => {
				const entry = draft[model] || {};
				return (entry[phase] || {})[field] ?? 0;
			};

			return h("div", { className: "ksw-card" },
				h("div", { className: "ksw-cardHead" },
					h("span", { className: "ksw-cardTitle" }, t("spendTitle")),
					h("div", { className: "ksw-ranges" },
						h("div", { className: "ksw-seg" }, ranges.map((value) => h("button", {
							key: value,
							className: `ksw-segItem${value === range ? " active" : ""}`,
							type: "button",
							onClick: () => onRange(value)
						}, rangeLabels[value]))),
						h("div", { className: "ksw-seg" }, groups.map((value) => h("button", {
							key: value,
							className: `ksw-segItem${value === activeGroup ? " active" : ""}`,
							type: "button",
							onClick: () => onGroup(value)
						}, groupLabels[value])))
					)
				),
				rows.length
					? h("div", { className: "ksw-table" },
						h("div", { className: "ksw-tr ksw-th" },
							h("span", { className: "ksw-td name" }, ""),
							Array.from({ length: segments }, (_, i) => h("span", { className: "ksw-td num", key: i },
								t("segName", { a: String(i * hours).padStart(2, "0"), b: String((i + 1) * hours).padStart(2, "0") }))),
							h("span", { className: "ksw-td num" }, t("colTotal"))
						),
						rows.map((row) => h("div", { className: "ksw-tr", key: row.id },
							h("span", { className: "ksw-td name", title: row.title }, `${row.title || row.id}`),
							row.segments.map((cell, i) => h("span", { className: "ksw-td num", key: i }, cellText(cell, row.priced))),
							h("span", { className: "ksw-td num strong" }, totalOf(row))
						))
					)
					: h("div", { className: "ksw-sub" }, t("noSessions")),
				report && !report.totals.priced ? h("div", { className: "ksw-legend" }, t("noPrices")) : null,
				models.length
					? h("div", { className: "ksw-form" },
						h("div", { className: "ksw-label" }, t("pricesTitle")),
						models.map((model) => h("div", { className: "ksw-priceRow", key: model },
							h("span", { className: "ksw-priceName" }, model),
							h("span", { className: "ksw-legend" }, t("pricePeak")),
							["in", "hit", "out"].map((field) => h("input", {
								key: "p" + field,
								className: "ksw-num small",
								type: "number",
								min: "0",
								step: "0.01",
								title: t(field === "in" ? "priceIn" : field === "hit" ? "priceHit" : "priceOut"),
								value: rateOf(model, "peak", field),
								onChange: (event) => setRate(model, "peak", field, event.target.value)
							})),
							h("span", { className: "ksw-legend" }, t("priceOff")),
							["in", "hit", "out"].map((field) => h("input", {
								key: "o" + field,
								className: "ksw-num small",
								type: "number",
								min: "0",
								step: "0.01",
								title: t(field === "in" ? "priceIn" : field === "hit" ? "priceHit" : "priceOut"),
								value: rateOf(model, "offpeak", field),
								onChange: (event) => setRate(model, "offpeak", field, event.target.value)
							}))
						)),
						h("div", { className: "ksw-actions" },
							h("button", { className: "ksw-btn primary", type: "button", disabled: busy, onClick: () => onSavePrices(draft) }, t("savePrices"))
						)
					)
					: null
			);
		}

		/** 自动策略卡：两个开关默认都关着，关了就等于纯展示。 */
		function PolicyCard(props) {
			const { policy, provider, busy, onSave } = props;
			const [draft, setDraft] = React.useState(policy);
			React.useEffect(() => { setDraft(policy); }, [policy]);
			if (!draft) return null;

			const keys = (provider && provider.keys) || [];
			const auto = draft.autoSwitch || {};
			const bal = draft.balance || {};
			const thresholds = auto.threshold || {};
			const setAuto = (patch) => setDraft({ ...draft, autoSwitch: { ...auto, ...patch } });
			const setBal = (patch) => setDraft({ ...draft, balance: { ...bal, ...patch } });
			const setWeight = (id, value) => setBal({ weights: { ...(bal.weights || {}), [id]: value } });
			const state = draft.state || {};

			const stateLine = state.lastSwitchAt
				? t("lastAction", {
					from: state.lastFrom || "—",
					to: state.lastTo || "—",
					reason: state.lastReason === "threshold" ? t("reasonThreshold") : t("reasonBalance")
				})
				: t("policyOff");

			return h("div", { className: "ksw-card" },
				h("div", { className: "ksw-cardHead" },
					h("span", { className: "ksw-cardTitle" }, t("autoTitle"))
				),
				h("div", { className: "ksw-form" },
					h("label", { className: "ksw-toggle" },
						h("input", {
							type: "checkbox",
							checked: Boolean(auto.enabled),
							onChange: (event) => setAuto({ enabled: event.target.checked })
						}),
						h("span", null, t("autoSwitch"))
					),
					h("div", { className: "ksw-sub" }, t("autoSwitchDesc")),
					h("div", { className: "ksw-field" },
						h("span", { className: "ksw-label" }, t("threshold")),
						h("input", {
							className: "ksw-num",
							type: "number",
							min: "0",
							step: "0.5",
							value: thresholds.default ?? 10,
							onChange: (event) => setAuto({ threshold: { ...thresholds, default: Number(event.target.value) } })
						}),
						h("span", { className: "ksw-legend" }, t("thresholdHint"))
					)
				),
				h("div", { className: "ksw-form" },
					h("label", { className: "ksw-toggle" },
						h("input", {
							type: "checkbox",
							checked: Boolean(bal.enabled),
							onChange: (event) => setBal({ enabled: event.target.checked })
						}),
						h("span", null, t("autoBalance"))
					),
					h("div", { className: "ksw-sub" }, t("autoBalanceDesc")),
					keys.length
						? h("div", { className: "ksw-rows" }, keys.map((key) => h("div", { className: "ksw-weightRow", key: key.id },
							h("span", { className: "ksw-weightName" }, `${key.note || t("noNote")} · ${key.masked}`),
							h("input", {
								className: "ksw-num",
								type: "number",
								min: "0",
								step: "0.5",
								value: (bal.weights || {})[key.id] ?? 1,
								onChange: (event) => setWeight(key.id, Number(event.target.value))
							})
						)))
						: null,
					h("div", { className: "ksw-field" },
						h("span", { className: "ksw-label" }, t("tolerance")),
						h("input", {
							className: "ksw-num",
							type: "number",
							min: "0",
							max: "100",
							step: "1",
							value: bal.tolerancePercent ?? 20,
							onChange: (event) => setBal({ tolerancePercent: Number(event.target.value) })
						}),
						h("span", { className: "ksw-legend" }, t("toleranceUnit"))
					)
				),
				h("div", { className: "ksw-actions" },
					h("button", {
						className: "ksw-btn primary",
						type: "button",
						disabled: busy,
						onClick: () => onSave({ autoSwitch: draft.autoSwitch, balance: draft.balance })
					}, t("save"))
				),
				h("div", { className: "ksw-legend" }, stateLine)
			);
		}

		/** 设置页里的趋势卡：阶梯图 + 今日已花 / 日均 / 预计可用天数。 */
		function TrendCard(props) {
			const { summary, points, range, onRange, currency } = props;
			const [hover, setHover] = React.useState(null);
			const okPoints = (points || []).filter((point) => point.ok !== false && point.v !== undefined);
			const money = (value) => {
				const sign = CURRENCY_SIGN[currency] || "";
				return sign ? `${sign}${value}` : `${value} ${currency || ""}`.trim();
			};
			const geometry = buildStepPath(points, 600, 120, 6);
			const ranges = ["24h", "7d", "30d"];

			/** 指针位置 → 最近一个"已经生效"的样本（余额是阶梯，取左侧那个点）。 */
			function handleMove(event) {
				if (!geometry || okPoints.length < 2) return;
				const rect = event.currentTarget.getBoundingClientRect();
				if (!rect.width) return;
				const frac = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
				const t0 = okPoints[0].t;
				const t1 = okPoints[okPoints.length - 1].t;
				const target = t0 + frac * Math.max(1, t1 - t0);
				let hit = okPoints[0];
				for (const point of okPoints) {
					if (point.t <= target) hit = point;
					else break;
				}
				setHover({ t: hit.t, v: hit.v, x: geometry.xFrac(hit.t), y: geometry.yFrac(hit.v) });
			}
			const labels = { "24h": t("range24h"), "7d": t("range7d"), "30d": t("range30d") };

			return h("div", { className: "ksw-card" },
				h("div", { className: "ksw-cardHead" },
					h("span", { className: "ksw-cardTitle" }, t("trend")),
					h("div", { className: "ksw-ranges" }, ranges.map((value) => h("button", {
						key: value,
						className: `ksw-range${value === range ? " active" : ""}`,
						type: "button",
						onClick: () => onRange(value)
					}, labels[value])))
				),
				h("div", { className: "ksw-stats" },
					h("div", { className: "ksw-stat" },
						h("span", { className: "ksw-statLabel" }, t("current")),
						h("span", { className: "ksw-statValue" }, summary && summary.balance ? money(summary.balance) : "—")
					),
					h("div", { className: "ksw-stat" },
						h("span", { className: "ksw-statLabel" }, t("todaySpend")),
						h("span", { className: "ksw-statValue" }, summary ? money(summary.todaySpend) : "—")
					),
					h("div", { className: "ksw-stat" },
						h("span", { className: "ksw-statLabel" }, t("burnPerDay")),
						h("span", { className: "ksw-statValue" }, summary ? money(summary.burnPerDay) : "—")
					),
					h("div", { className: "ksw-stat" },
						h("span", { className: "ksw-statLabel" }, t("daysLeft")),
						h("span", { className: "ksw-statValue" },
							summary && summary.daysLeft !== null && summary.daysLeft !== undefined
								? t("daysValue", { n: summary.daysLeft })
								: "—")
					)
				),
				geometry
					? h("div", {
						className: "ksw-chartWrap",
						onMouseMove: handleMove,
						onMouseLeave: () => setHover(null)
					},
						hover ? h("div", { className: "ksw-guide", style: { left: `${hover.x * 100}%` } }) : null,
						hover ? h("div", { className: "ksw-dot", style: { left: `${hover.x * 100}%`, top: `${hover.y * 100}%` } }) : null,
						hover ? h("div", {
							className: `ksw-tip${hover.x > 0.78 ? " flip" : ""}`,
							style: { left: `${hover.x * 100}%`, top: `${hover.y * 100}%` }
						},
							h("span", { className: "ksw-tipTime" }, stampOf(hover.t)),
							h("span", { className: "ksw-tipValue" }, money(hover.v))
						) : null,
						h("svg", { className: "ksw-chart", viewBox: "0 0 600 120", preserveAspectRatio: "none", role: "img", "aria-label": t("trend") },
						h("line", { className: "ksw-grid", x1: 0, y1: 6, x2: 600, y2: 6 }),
						h("line", { className: "ksw-grid", x1: 0, y1: 60, x2: 600, y2: 60 }),
						h("line", { className: "ksw-grid", x1: 0, y1: 114, x2: 600, y2: 114 }),
						h("text", { className: "ksw-axis", x: 2, y: 16 }, money(String(geometry.max))),
						h("text", { className: "ksw-axis", x: 2, y: 112 }, money(String(geometry.min))),
							h("path", { className: "ksw-line", d: geometry.d })
						)
					)
					: h("div", { className: "ksw-sub" }, t("noHistory")),
				h("div", { className: "ksw-legend" }, t("samplesCount", { n: (points || []).length }))
			);
		}

		function KeySwitchPage() {
			const [state, setState] = React.useState({ loading: true, providers: [], balances: {}, balanceAt: 0, range: "7d", history: null, policy: null, spendRange: "today", spendGroup: "session", report: null, prices: null });
			const [busy, setBusy] = React.useState(false);
			const [forms, setForms] = React.useState({});
			const [revealed, setRevealed] = React.useState({});
			const revealTimers = React.useRef({});
			const [copiedId, setCopiedId] = React.useState("");
			const copiedTimers = React.useRef({});

			React.useEffect(() => () => {
				Object.values(revealTimers.current).forEach((timer) => clearTimeout(timer));
				Object.values(copiedTimers.current).forEach((timer) => clearTimeout(timer));
			}, []);

			/** 只取值，不动界面——复制用它，屏幕上不留明文。 */
			async function fetchKey(providerId, id) {
				try {
					const result = await call("reveal", { providerId, id });
					if (!result || result.ok === false) {
						flash(errorText(result), "err");
						return "";
					}
					return result.value;
				} catch (error) {
					flash(t("revealFailed"), "err");
					return "";
				}
			}

			/** 取一把 key 的明文并显示出来；30 秒后自动收回。 */
			async function revealKey(providerId, id) {
				const value = await fetchKey(providerId, id);
				if (!value) return "";
				try {
					setRevealed((current) => ({ ...current, [id]: value }));
					clearTimeout(revealTimers.current[id]);
					revealTimers.current[id] = setTimeout(() => {
						setRevealed((current) => {
							const next = { ...current };
							delete next[id];
							return next;
						});
					}, 30_000);
					return value;
				} catch (error) {
					flash(t("revealFailed"), "err");
					return "";
				}
			}

			function hideKey(id) {
				clearTimeout(revealTimers.current[id]);
				setRevealed((current) => {
					const next = { ...current };
					delete next[id];
					return next;
				});
			}

			/**
			 * 复制：**不显示明文**（录屏场景要的就是这个），只把值写进剪贴板，
			 * 然后按钮临时变成对勾 + 底部提示，确认复制成功。
			 */
			async function copyKey(providerId, id) {
				const value = revealed[id] || (await fetchKey(providerId, id));
				if (!value) return;
				try {
					await navigator.clipboard.writeText(value);
					setCopiedId(id);
					clearTimeout(copiedTimers.current[id]);
					copiedTimers.current[id] = setTimeout(() => setCopiedId(""), 1600);
					flash(t("copied"));
				} catch (error) {
					flash(t("revealFailed"), "err");
				}
			}

			const [advancedOpen, setAdvancedOpen] = React.useState(() => {
				try {
					return window.localStorage.getItem("dsh-key-switch:advanced") === "1";
				} catch (error) {
					return false;
				}
			});

			function toggleAdvanced() {
				setAdvancedOpen((open) => {
					const next = !open;
					try {
						window.localStorage.setItem("dsh-key-switch:advanced", next ? "1" : "0");
					} catch (error) {
						// 存不了就只是不记忆
					}
					return next;
				});
			}

			const formOf = (providerId) => forms[providerId] || { value: "", note: "" };

			function setForm(providerId, patch) {
				setForms((current) => ({ ...current, [providerId]: { ...(current[providerId] || { value: "", note: "" }), ...patch } }));
			}

			function flash(text, kind) {
				showToast(text, kind);
			}

			async function load(rangeArg) {
				const range = rangeArg || state.range || "7d";
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
					let history = null;
					try {
						history = await call(`history?range=${range}`);
					} catch (error) {
						// 历史读不到就不画图，其余照常。
						history = null;
					}
					let policy = null;
					try {
						policy = (await call("policy")).policy || null;
					} catch (error) {
						policy = null;
					}
					let report = null;
					try {
						report = await call(`attribution?range=${state.spendRange || "today"}&group=${state.spendGroup || "session"}`);
					} catch (error) {
						report = null;
					}
					let prices = null;
					try {
						prices = (await call("prices")).prices || null;
					} catch (error) {
						prices = null;
					}
					setState({ loading: false, providers: (data && data.providers) || [], balances, balanceAt, range, history, policy, report, prices, spendRange: state.spendRange || "today" });
					const justSwitched = policy && policy.state && policy.state.lastSwitchAt
						&& Date.now() - policy.state.lastSwitchAt < 60_000;
					if (justSwitched) {
						flash(t("lastAction", {
							from: policy.state.lastFrom || "—",
							to: policy.state.lastTo || "—",
							reason: policy.state.lastReason === "threshold" ? t("reasonThreshold") : t("reasonBalance")
						}));
					}
				} catch (error) {
					setState((current) => ({ ...current, loading: false, providers: [], balances: {}, balanceAt: 0 }));
					flash(t("loadFailed", { message: error && error.message ? error.message : String(error) }), "err");
				}
			}

			/** 切会话消耗的时间范围。 */
			async function changeSpendRange(next) {
				setState((current) => ({ ...current, spendRange: next }));
				try {
					const group = state.spendGroup || "session";
					const report = await call(`attribution?range=${next}&group=${group}`);
					setState((current) => ({ ...current, report }));
				} catch (error) {
					// 失败就停在原表
				}
			}

			/** 切聚合维度：会话 / 工作区 / 模型（对应官方那张图的「调用类型 / API Key」）。 */
			async function changeSpendGroup(next) {
				setState((current) => ({ ...current, spendGroup: next }));
				try {
					const range = state.spendRange || "today";
					const report = await call(`attribution?range=${range}&group=${next}`);
					setState((current) => ({ ...current, report, spendGroup: next }));
				} catch (error) {
					// 失败就停在原表
				}
			}

			/** 保存单价：价表由用户提供，插件不内置金额。 */
			async function savePrices(prices) {
				setBusy(true);
				try {
					const result = await call("prices", { prices });
					if (!result || result.ok === false) {
						flash(t("opFailed"), "err");
						return;
					}
					const report = await call(`attribution?range=${state.spendRange || "today"}`);
					setState((current) => ({ ...current, prices: result.prices, report }));
					flash(t("saved"));
				} catch (error) {
					flash(t("requestFailed", { message: error && error.message ? error.message : String(error) }), "err");
				} finally {
					setBusy(false);
				}
			}

			/** 保存自动策略；关掉时宿主那边也只是不评估。 */
			async function savePolicy(patch) {
				setBusy(true);
				try {
					const result = await call("policy", patch);
					if (!result || result.ok === false) {
						flash(t("opFailed"), "err");
						return;
					}
					setState((current) => ({ ...current, policy: result.policy }));
					flash(t("saved"));
				} catch (error) {
					flash(t("requestFailed", { message: error && error.message ? error.message : String(error) }), "err");
				} finally {
					setBusy(false);
				}
			}

			/** 切时间范围：只重取历史，不动池子。 */
			async function changeRange(next) {
				setState((current) => ({ ...current, range: next }));
				try {
					const history = await call(`history?range=${next}`);
					setState((current) => ({ ...current, history }));
				} catch (error) {
					// 失败就停在原图
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
					revealed[key.id]
						? h("span", { className: "ksw-rawKey", title: revealed[key.id] }, revealed[key.id])
						: h("span", { className: "ksw-mono" }, key.masked),
					h("button", {
						className: "ksw-iconBtn",
						type: "button",
						title: revealed[key.id] ? t("hide") : t("show"),
						"aria-label": revealed[key.id] ? t("hide") : t("show"),
						onClick: () => (revealed[key.id] ? hideKey(key.id) : revealKey(provider.providerId, key.id))
					}, h(EyeIcon, { off: Boolean(revealed[key.id]) })),
					h("button", {
						className: "ksw-iconBtn",
						type: "button",
						title: t("copy"),
						"aria-label": t("copy"),
						disabled: busy,
						onClick: () => copyKey(provider.providerId, key.id)
					}, copiedId === key.id ? h(CheckIcon, null) : h(CopyIcon, null)),
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

				const first = providers[0];
				const activeKey = (first.keys || []).find((key) => key.active);
				const seriesKey = activeKey ? activeKey.id : `live:${first.ref}`;
				const series = (state.history && state.history.series && state.history.series[seriesKey]) || [];
				const summary = (state.history && state.history.summary && state.history.summary[seriesKey]) || null;
				body.push(h("button", {
					key: "advanced",
					className: `ksw-adv${advancedOpen ? " advOpen" : ""}`,
					type: "button",
					"aria-expanded": advancedOpen ? "true" : "false",
					onClick: toggleAdvanced
				},
					h("span", null, t("advanced")),
					h("svg", {
						className: `ksw-advCaret${advancedOpen ? " open" : ""}`,
						width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", "aria-hidden": true
					}, h("path", {
						d: "M3 5.5 7 9.5 11 5.5",
						stroke: "currentColor", strokeWidth: 1.4,
						strokeLinecap: "round", strokeLinejoin: "round"
					}))
				));

				if (advancedOpen) {
					body.push(h("div", { className: "ksw-advBody", key: "advanced-body" },
						h(TrendCard, {
							key: "trend",
							summary,
							points: series,
							range: state.range || "7d",
							currency: (summary && summary.currency) || "",
							onRange: changeRange
						}),
						h(SpendCard, {
							key: "spend",
							report: state.report,
							range: state.spendRange || "today",
							group: state.spendGroup || "session",
							onGroup: changeSpendGroup,
							prices: state.prices,
							busy,
							onRange: changeSpendRange,
							onSavePrices: savePrices
						}),
						h(PolicyCard, {
							key: "policy",
							policy: state.policy,
							provider: first,
							busy,
							onSave: savePolicy
						})
					));
				}
			}

			// 手动重试：浏览器到本机的连接被占满时请求会排队，关掉多余的 DSH 标签页再点它。
			body.push(h("div", { className: "ksw-actions", key: "reload" },
				state.balanceAt ? h("span", { className: "ksw-hint" }, t("balanceUpdatedAt", { time: timeTextOf(state.balanceAt) })) : null,
				h("button", { className: "ksw-btn", type: "button", disabled: busy, onClick: refreshBalances }, t("refreshBalance")),
				h("button", { className: "ksw-btn", type: "button", disabled: busy, onClick: () => { flash(""); load(); } }, t("reload"))
			));

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
						id: "key-switch-toast",
						order: 9
					},
					() => h(ToastLayer, null)
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
