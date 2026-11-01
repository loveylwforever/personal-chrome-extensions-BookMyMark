import { createApp } from 'vue';
import App from './App.vue';
import '~/assets/main.css';

const el = document.getElementById('app');

try {
  createApp(App).mount('#app');
} catch (err) {
  console.error('[BookMyMark] mount failed', err);
  if (el) {
    el.textContent =
      'BookMyMark 启动失败：' +
      (err instanceof Error ? err.message : String(err));
  }
}

window.addEventListener('unhandledrejection', (e) => {
  console.error('[BookMyMark] unhandledrejection', e.reason);
});
