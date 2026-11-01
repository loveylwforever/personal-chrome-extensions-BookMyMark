<p align="center">
  <img src="public/icon/128.png" width="96" height="96" alt="BookMyMark" />
</p>

<h1 align="center">BookMyMark</h1>

<p align="center">
  <strong>精致的 Chrome 新标签页书签管理器</strong><br />
  <em>A polished Chrome new-tab bookmark manager</em>
</p>

<p align="center">
  <a href="#中文">中文</a> ·
  <a href="#english">English</a> ·
  <a href="LICENSE">MIT</a>
</p>

<p align="center">
  <img src="store-assets/out/marquee-1400x560.jpg" width="100%" alt="BookMyMark hero" />
</p>

---

## 中文

把杂乱的书签栏，变成一页好看、好找、还能顺手专注的新标签页。

BookMyMark 用目录树管理收藏，支持即时搜索、按域名魔法整理、失效链接探活；首页还有待办、甘特排期和跨标签同步的番茄钟。数据都在本机，扩展不收集你的浏览内容。

### 特色

| | |
|---|---|
| **导航式书签** | 侧栏目录、收藏 / 最常 / 最近标签、卡片多视图，打开新标签就能浏览。 |
| **首页工作台** | 待办清单 + 待办甘特 + 番茄钟；时长按 15 分钟一档，番茄钟在多个书签页同步走表。 |
| **魔法整理** | 按域名收拢散落书签、一键去重，再配合 DNS 探活找出失效站点。 |
| **本地工具箱** | JSON 格式化 / 嵌套转义解析 / 树形查看，以及 URL 编解码；历史只存本机。 |
| **观感与语言** | 浅色 / 深色 / 跟随系统，多套配色；中 / EN / 日 / 韩 / 俄 / 法 / 印地语。 |
| **隐私优先** | 书签走 Chrome API，待办与设置存在 `chrome.storage.local`；探活与公网 IP 只请求必要的公开接口。 |

### 截图

<p align="center">
  <img src="store-assets/out/screenshot-01-overview.jpg" width="48%" alt="书签总览" />
  <img src="store-assets/out/screenshot-06-home.jpg" width="48%" alt="首页待办与番茄钟" />
</p>
<p align="center">
  <img src="store-assets/out/screenshot-03-arrange.jpg" width="48%" alt="魔法整理" />
  <img src="store-assets/out/screenshot-04-dark.jpg" width="48%" alt="深色主题" />
</p>

### 安装

**从源码加载（开发 / 自用）**

```sh
pnpm install
pnpm build
```

1. 打开 `chrome://extensions` → 开启开发者模式  
2. 「加载已解压的扩展程序」→ 选择 `.output/chrome-mv3`  
3. 打开新标签页即可使用  

开发热更新：

```sh
pnpm install
pnpm dev
```

保持 `pnpm dev` 运行，加载 `.output/chrome-mv3-dev`。关掉开发服务器后，开发版新标签页会白屏。

商店安装包：

```sh
pnpm zip
```

产物：`.output/bookmymark-*-chrome.zip`

### 技术栈

[WXT](https://wxt.dev) · Vue 3 · Tailwind CSS 4 · TypeScript · Chrome MV3

### 许可

[MIT](./LICENSE)

---

## English

Turn a messy bookmarks bar into a calm, searchable new-tab workspace—with focus tools when you need them.

BookMyMark replaces the new tab with a navigation-style bookmark home: folder tree, instant search, domain arrange, and dead-link probing. The Home board adds todos, a schedule Gantt, and a pomodoro clock that stays in sync across bookmark tabs. Everything stays on your device—the extension does not collect your browsing data.

### Highlights

| | |
|---|---|
| **Bookmark navigation** | Sidebar folders, Favorites / Most / Recent tags, and multi-view cards—browse the moment you open a new tab. |
| **Home workspace** | Todos + Gantt + pomodoro. Durations snap to 15-minute steps; the timer stays aligned across tabs. |
| **Magic arrange** | Group scattered bookmarks by domain, dedupe, then DNS-probe for dead sites. |
| **Local toolbox** | JSON format / nested-unescape / tree view, plus URL encode & decode. History stays in local storage only. |
| **Look & language** | Light / dark / system themes, accent colors, and 7 UI languages (zh / en / ja / ko / ru / fr / hi). |
| **Privacy first** | Bookmarks via Chrome APIs; todos and settings in `chrome.storage.local`. Probe and public-IP features call only the endpoints they need. |

### Screenshots

<p align="center">
  <img src="store-assets/out/screenshot-01-overview.jpg" width="48%" alt="Bookmark overview" />
  <img src="store-assets/out/screenshot-06-home.jpg" width="48%" alt="Home todos and pomodoro" />
</p>
<p align="center">
  <img src="store-assets/out/screenshot-03-arrange.jpg" width="48%" alt="Magic arrange" />
  <img src="store-assets/out/screenshot-04-dark.jpg" width="48%" alt="Dark theme" />
</p>

### Install

**Load from source**

```sh
pnpm install
pnpm build
```

1. Open `chrome://extensions` → enable Developer mode  
2. “Load unpacked” → select `.output/chrome-mv3`  
3. Open a new tab  

Dev with HMR:

```sh
pnpm install
pnpm dev
```

Keep `pnpm dev` running and load `.output/chrome-mv3-dev`. If you stop the server, the dev new-tab page goes blank.

Chrome Web Store zip:

```sh
pnpm zip
```

Output: `.output/bookmymark-*-chrome.zip`

### Stack

[WXT](https://wxt.dev) · Vue 3 · Tailwind CSS 4 · TypeScript · Chrome MV3

### License

[MIT](./LICENSE)
