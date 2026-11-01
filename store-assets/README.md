# Chrome Web Store 宣传图

用 HTML 复刻 BookMyMark UI（演示书签，不含真实数据），再由 Playwright 按商店尺寸导出 JPEG。

## 产出（`out/`）

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `screenshot-01-overview.jpg` | 1280×800 | 总览 |
| `screenshot-02-search.jpg` | 1280×800 | 搜索 |
| `screenshot-03-arrange.jpg` | 1280×800 | 魔法整理 |
| `screenshot-04-dark.jpg` | 1280×800 | 深色主题 |
| `screenshot-05-i18n.jpg` | 1280×800 | 多语言 |
| `screenshot-06-home.jpg` | 1280×800 | 首页：待办、甘特、番茄钟 |
| `marquee-1400x560.jpg` | 1400×560 | 顶部宣传图块 |

格式：JPEG，无 alpha，符合商店要求。

## 重新生成

```sh
pnpm exec playwright install chromium   # 首次
pnpm exec node store-assets/capture.mjs
```

修改 `src/mock.html` 中的场景文案 / 演示数据后重新运行即可。
