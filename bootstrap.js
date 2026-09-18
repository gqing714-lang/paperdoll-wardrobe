import { ensureBundledStatusRegex } from './status-regex.js';

// 正则同步必须先于纸娃娃主体启动，避免主体初始化失败时连配套正则也无法安装。
ensureBundledStatusRegex();

import('./index.js?v=0.2.28').catch(error => {
  console.error('[纸娃娃] 主体加载失败：', error);
});
