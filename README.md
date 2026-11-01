# BookMyMark

Chrome 书签管理扩展，基于 [WXT](https://wxt.dev) + Vue 3，新标签页体验对齐 OhMyNote 网址导航。

License: [MIT](./LICENSE)

## 开发

```sh
pnpm install
pnpm dev
```

**重要：** `pnpm dev` 必须保持运行。开发版 `newtab.html` 会从 `http://localhost:3000` 拉脚本；关掉终端后新标签页会白屏，并出现 `ws://localhost:3000` 连接失败。

1. 终端里执行 `pnpm dev`，看到 `Started dev server @ http://localhost:3000`
2. 打开 `chrome://extensions` → 开发者模式 →「加载已解压的扩展程序」
3. 选择目录：`.output/chrome-mv3-dev`
4. 打开新标签页

改代码后若页面异常，在扩展页点「重新加载」，再刷新新标签页。

## 不依赖开发服务器（推荐排查白屏时用）

```sh
pnpm build
```

加载 `.output/chrome-mv3`（注意没有 `-dev`）。此包自包含，不连 localhost。

## 构建

```sh
pnpm build
```

产物在 `.output/chrome-mv3/`。
