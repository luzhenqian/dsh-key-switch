# dsh-key-switch

[English](README.en.md) | 中文

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）用的 API Key 池插件：**多把 DeepSeek key 放在一个池子里，一键切换当前生效的那把，并且每把 key 各自还剩多少钱一目了然。**

`deepseek-official` 在 dsh 里是**单一路由**（`PROVIDER` 写死），一个路由只能挂一把 key。想用多个账号，只能在"换 key"上做文章——这个插件就是干这个的。

## 功能

- **侧边栏余额入口**：`设置` 上方一行，实时显示当前生效 key 的余额，60 秒自动刷新
- **点开即切换**：弹层里每把 key 一行，带备注、掩码、余额；点哪行就切到哪把，下一次模型调用生效，**不用重启**
- **每把 key 各自的余额**：宿主进程直接向 `api.deepseek.com/user/balance` 查询，60 秒缓存，`刷新余额` 可强制重查；自动识别 CNY / USD 多币种
- **管理页**：设置 → `Key 切换`，添加 / 删除 / 切换，支持备注（"个人账号"、"公司账号"…）
- **原生外观**：字号、颜色、描边、阴影全部用 dsh 自己的 `--dsw-*` 设计令牌，浅色深色自动跟随

## 安装

```sh
dsh plugin --profile web add dsh-key-switch
```

装完重启一次 `dsh web`（宿主插件层只在启动时加载），然后：

1. 设置 → **Key 切换** → 把 key 一个个粘进去，填个备注
2. 侧边栏底部会出现余额入口，点开就能切

## 它是怎么切换的

切换不是改配置，也不是劫持请求：插件把值**写进 `$DSH_HOME/.credentials.yaml` 里 `deepseek-official` 引用的那个凭据项**（默认 `DEEPSEEK_API_KEY`），宿主对凭据文件有热重载，下一次模型调用就用新值。

写入是原子替换（临时文件 + rename），并且**写完会回读校验**，值对不上就报错而不是假装成功。

> 如果你的环境变量里也定义了同名变量（`DEEPSEEK_API_KEY`），它会盖住文件里的值——界面会直接提示，这种情况下切换不会生效。

## 数据与安全

| 项 | 说明 |
|---|---|
| key 存在哪 | `$DSH_HOME/dsh-key-switch/keys.json`，权限 `0600`（明文——不存值就换不了 key） |
| 浏览器能看到什么 | 只有 `****后四位`，完整值永远不出宿主进程 |
| 写接口鉴权 | 要求同源会话 cookie，本机其它进程调不动 |
| 余额请求 | 由宿主发往 `api.deepseek.com`，不经浏览器、不受跨域限制 |
| 不做什么 | 不采集、不上传、不统计使用行为，没有任何第三方请求 |

卸载后 `~/.dsh/dsh-key-switch/` 会留下你的 key 池，需要的话手动删掉。

## 兼容性

在 **DSH 0.1.5-rc.3 + Web profile** 上实测（macOS / Chrome）。依赖：

- 宿主服务：`webServer`（硬依赖）、`settings` / `llm`（软取，拿不到就用默认的 `deepseek-official`）
- 客户端槽位：`sidebar.footer.action`、`shell.overlay`、`settings.section`

## 已知限制

- **只支持 DeepSeek 官方接口**的余额查询（其它厂商接口不同，没做）
- **一个 provider 一把 key**：这是 dsh 的限制，不是插件的；想同时用多个账号就得切
- **页面里同时开多个 dsh 标签页时**，浏览器对同一源只有 6 条连接，而每个标签页开两条常驻 SSE，新请求可能排队——此时入口会显示 `⚠ 余额不可用`，关掉多余标签页即可
- 余额查询失败不会影响切换和正常对话

## 卸载

```sh
dsh plugin --profile web remove dsh-key-switch
```

## License

MIT
