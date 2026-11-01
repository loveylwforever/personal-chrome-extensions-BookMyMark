import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
    server: {
      port: 3000,
      strictPort: true,
    },
  }),
  // 手动在 chrome://extensions 加载 .output/chrome-mv3-dev，避免自动开浏览器失败导致进程退出
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'BookMyMark',
    description: '精致的 Chrome 书签管理器',
    permissions: ['bookmarks', 'storage', 'favicon', 'activeTab'],
    // DNS probe and the public-IP card. Not every website.
    host_permissions: [
      'https://cloudflare-dns.com/*',
      'https://dns.google/*',
      'https://ip.3322.net/*',
      'https://myip.ipip.net/*',
      'https://ddns.oray.com/*',
      'https://whois.pconline.com.cn/*',
      'https://api.ipify.org/*',
      'https://ipv4.icanhazip.com/*',
      'https://ifconfig.me/*',
      'https://www.ifconfig.me/*',
    ],
  },
});
