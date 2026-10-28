# dsh-done-alert

任务完成提醒插件（**基于 [dthcle/dsh-badge-notify](https://github.com/dthcle/dsh-badge-notify) 二次开发，MIT**——在其任务栏徽标之上加了提示音，并把徽标配色改成与 DSH 侧边栏小圆点同义的绿/橙语义）。

两个能力，全部在 **Windows 桌面**上本地完成，不联网：

- **提示音**：任意会话一轮跑完（running → idle）时，电脑播放微信式"叮咚"提示音（`done.wav`）；出现提问待回答或权限申请待批准时播放更亮的提示音（`attention.wav`）。声音由宿主半端经 `Media.SoundPlayer` 播放，**浏览器标签页没开也会响**。
- **任务栏角标**：在任务栏的 DSH 图标上叠画一个鼠标穿透的浮层：
  - **带数字的圆角小方块**（图标右上角）＝未读的已完成会话数。"未读"与 DSH 侧边栏的绿点同义：会话跑完时你正在看它就不计数；打开该会话即视为已读、计数自动减掉（`badge.unreadOnly: false` 可改成全部计数）。
  - **颜色语义与侧边栏小圆点一致**：绿 `#22c55e`＝有未读完成；橙 `#f59e0b`＝有提问待回答/权限待批准。**既有完成又有待处理时优先显示橙色**（`badge.colorByAttention`，默认开）。
  - 图标左边缘可另配提示点（橙点＝提问，黄点＝权限申请，`dots.group: "kind"` 每类一个）。

## 安装

```powershell
dsh plugin --profile desktop add <本目录的绝对路径>
```

装完不用重启 DSH：宿主半端会把浮层载荷部署到 `%LOCALAPPDATA%\DshDoneAlert\` 并拉起，几秒内在任务栏 DSH 图标上即可看到徽标；提示音随首个事件播放。**设置 → 插件 → 完成提醒** 里有状态、启停与清零。

## 配置

`%LOCALAPPDATA%\DshDoneAlert\config.json`（改完约 2 秒自动生效）：

| 键 | 默认 | 说明 |
|---|---|---|
| `sound.enabled` | `true` | 提示音总开关 |
| `sound.onCompletion` | `true` | 会话完成时响 `done.wav` |
| `sound.onAttention` | `true` | 提问/权限申请时响 `attention.wav` |
| `sound.minGapMs` | `1500` | 同类提示音的最小间隔（防止连续完成时炸响） |
| `badge.colorByAttention` | `true` | 有待处理时角标变橙（橙优先于绿） |
| `badge.bgGreen` / `badge.bgOrange` | `#22c55e` / `#f59e0b` | 角标绿/橙颜色（可改成 DSH 主题色） |
| `badge.bg` | `#0d0d0d` | `colorByAttention: false` 时的底色（原版黑底） |
| `badge.unreadOnly` | `true` | 只统计未读完成（与绿点同义） |
| `dots.question` / `dots.approval` | `#f59e0b` / `#eab308` | 提示点颜色 |
| `uia.stuckMs` | `20000` | 后台 UIA 探针多久没有进展就判定为卡死并弃置（至少为刷新/重试间隔的 2 倍） |
| `uia.maxStuck` | `3` | 最多同时弃置几个卡死探针；到上限后冷却 60 秒再重试（徽标期间按最后已知位置继续绘制） |
| 其余锚点/尺寸键 | — | 与上游 dsh-badge-notify 相同，见其 README |

## 手动调参 / 管理 API

与上游一致，数据目录换成 `%LOCALAPPDATA%\DshDoneAlert\`：

- `preview.json`：`{"enabled": true, "count": 8, "dots": ["question", "approval"]}` 固定画面用于调位置。
- 管理（仅 loopback POST）：`/api/dsh-done-alert/status|start|stop|clear|read`。

## 与上游的差异（fork changelog）

1. 新增提示音（宿主半端 `Media.SoundPlayer`，`assets/*.wav` 随载荷部署，`sound.*` 配置）。
2. 角标配色从固定黑底改为绿/橙状态色（`badge.colorByAttention`、`badge.bgGreen/bgOrange`），语义对齐 DSH 侧边栏小圆点，橙优先。
3. 提示点默认配色改为 橙（提问）/ 黄（权限）。
4. 包名、数据目录（`DshDoneAlert`）、管理路由（`/api/dsh-done-alert/*`）、互斥量与设置页文案相应改名；设置页标题"完成提醒"。
5. v1.1.0：兼容 dsh-study-ask 的 `studyAsk` 保留标签（视为已读信号）+ 未读完成 TTL 自动过期（`badge.unreadTtlMs`）+ `/chime` 试听路由与播放错误落盘（`logs/chime.log`）。
6. v1.2.0：修复 UIA 卡死——原先所有 UIA 调用（含"找不到任务栏按钮"时的搜索）都在 WinForms UI 线程上，任务栏 provider 一旦阻塞就会把整个浮层钉死（实测单次调用卡死 9.6 小时 / 5.3 小时，期间徽标不刷新、任务栏发涩）。现在全部 UIA 调用移入独立的 MTA 后台探针线程，UI 线程只读快照；探针超过 `uia.stuckMs` 无进展即弃置并换新，至多 `uia.maxStuck` 个，之后冷却 60 秒——UI 线程从此永不等待 UIA。`-TestInstance` 与 `DSH_DONE_ALERT_UIA_STUCK_TEST=1` 仅供测试。

## 与其他插件的兼容

- **dsh-study-ask（学习提问）**：它的提问标签页用独立的 `studyAsk` 保留标签挂在右侧栏，行被 CSS 隐藏、不出现在左侧会话列表——因此永远走不通"打开会话=已读"的规则。v1.1.0 起，done-alert 把 `retainedBy.studyAsk > 0` 也视为"正在看"：**提问标签页开着时**问题跑完不计数不响铃；**标签页关着时**跑完照常响铃计数，之后打开对应提问标签即视为已读、计数清掉。
- **兜底 TTL**：仍未读的完成超过 `badge.unreadTtlMs`（默认 24 小时，0=永不过期）会自动过期，任何"永远无法已读"的隐藏会话都不会再把角标卡死。

## 致谢与许可

上游 [dsh-badge-notify](https://github.com/dthcle/dsh-badge-notify)（MIT, © 2026 dthcle）完成了最难的部分：UIA 任务栏定位、像素级图标测量、分层窗口叠画与未读语义镜像。本仓库沿用 MIT（见 `LICENSE`）。
