# 仓库说明

当前基础版本来自 `st-paperdoll-wardrobe-local-test-v0.2.27.zip`，保留原有可安装的扩展目录布局与运行逻辑。

| 位置 | 内容 | 版本来源 |
| --- | --- | --- |
| 仓库根目录 | SillyTavern 扩展本体；`index.js`、`bootstrap.js`、样式、正则、依赖等 | `manifest.json` 的 `version`，当前 `0.2.31` |
| `assets/` 和 `data/asset-registry.json` | 扩展自带素材及其索引 | `assets/pack-version.json` 的 `version`，从 `0.1.0` 开始独立记录 |
| `packs/` | 以后发布的独立 ZIP 图包 | 每个图包自身 `pack.json` 的 `version` |
| `examples/图包模板/` | 制作示例 | 示例版本不代表正式图包版本 |

框架代码或扩展配置变更时更新框架版本；仅修改内置素材及对应索引时更新内置图包版本；独立图包更新时只改该图包自己的版本。需要同时修改两类内容时，分别更新对应版本。`bootstrap.js` 的缓存参数和版本化 CSS 文件名在框架发版时仍需与框架版本保持一致。

目前 `assets/pack-version.json` 只记录版本，扩展尚未读取它。扩展设置页也尚未同时显示框架版本与内置图包版本；已导入图包的版本则由现有图包列表显示。`manifest.json` 暂时保留 `auto_update: false`；扩展里的「检查更新」按钮会调用 SillyTavern 自带的更新接口，检查并拉取这个仓库的新提交，更新完成后可直接刷新页面。

以后从 Google Drive 取得素材，核对文件与图包配置后，再放入 `packs/` 发布。v0.2.30 已为 AI 剧情款接入 Overlay（覆盖）染色，v0.2.31 修正极端色的细节损失；多区域名称及前后片蒙版由图包声明，模型只为已声明区域选颜色。手动高级染色仍用原算法。本次只更新框架版本，内置素材版本仍为 `0.1.0`。
