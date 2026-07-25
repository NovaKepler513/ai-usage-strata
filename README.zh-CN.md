# AI Usage Strata

[English](README.md) · [简体中文](README.zh-CN.md)

一个完全在本机浏览器运行的 AI 用量账本。它把你主动导入的小型 JSON 账本，变成可查看时间、输入、输出、工作分类与当天线索的交互页面。

## 它包含什么

- 总量、三维瀑布山脊图、预制视角、可直接滚动的起止日期、日期刻痕、按周／月对比和证据页。
- 中英文界面切换；选择会保存在这台设备上。
- 新的工作分类会自动出现在图中，无需修改代码。
- 可导入、导出、回到示例；导入数据只保留在当前浏览器。
- 轻量 JSON 格式、账本校验器与公开发布审计。

## 它刻意不做什么

- 不包含任何真实聊天、个人活动、文件路径、Git 历史或生成报告。
- 不上传数据，也没有账户、遥测或隐藏网络请求。
- 不把估算说成事实；每条估算都必须留下一句理由。

## 30 秒开始

1. 下载或克隆仓库。
2. 用现代浏览器打开 `index.html`，无需构建或服务端。macOS 可双击 `启动·AI Usage Strata.command`。
3. 先看示例，再点击“导入账本”选择自己的 JSON。
4. 点击山脊图的日期刻痕，查看当天留下的记录。

浏览器会把导入账本保存在本机。需要备份时点击“导出”；需要删除时点击“示例”回到虚构数据。

## 账本格式

完整字段说明见 [docs/ledger-format.md](docs/ledger-format.md)。每条记录至少需要日期和投入小时数：

```json
{
  "schema_version": "1.0",
  "profile": { "label": "我的账本" },
  "records": [{
    "date": "2026-07-24",
    "hours": 2.5,
    "category": "Research",
    "confidence": "recorded",
    "activity_count": 3,
    "evidence": [{ "type": "note", "label": "当天工作备注" }]
  }]
}
```

导入前可运行：

```bash
python3 scripts/validate_ledger.py path/to/my-ledger.json
```

可直接改造 [examples/minimal-ledger.json](examples/minimal-ledger.json)。

## 隐私与发布

这个工具不含服务端，也不会发起网络请求。你选择的 JSON 只在浏览器里解析和保存，直到你导出或重置。使用边界见 [docs/privacy.md](docs/privacy.md)。

公开发布前运行：

```bash
python3 scripts/release_audit.py
```

更完整的检查见 [docs/release-checklist.md](docs/release-checklist.md)。

MIT © 2026 Nova Kepler。示例账本是虚构数据，可与代码一同复用。
