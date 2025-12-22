/// <reference types="vite/client" />

// 如果你在某些环境里没有安装 vite 的类型定义（极少见），下面的最小声明可以避免 tsc 报错。
// 正常情况下不会生效（因为上面的 reference 会优先）。
interface ImportMetaEnv {
  readonly [key: string]: string | boolean | undefined;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
