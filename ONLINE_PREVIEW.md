# 在线预览（不需要本地 Node 环境）

你可以用任意在线 IDE（如 StackBlitz / CodeSandbox）打开本项目进行预览与截图。

## 方式 A：直接导入 Zip（推荐）
1. 打开在线 IDE 的 “Import/导入” 页面
2. 选择 “Upload/上传” 并上传本项目 zip
3. 等依赖安装完成后，运行 `npm run dev`（有些平台会自动运行）

> 说明：不同平台入口略有差异；如果你没找到 “上传导入”，用方式 B。

## 方式 B：新建 Vite React TS 工程后覆盖文件
1. 新建模板：Vite + React + TypeScript
2. 用本项目文件覆盖（至少覆盖下面这些）
   - package.json
   - vite.config.ts
   - index.html
   - src/**（整个 src 目录建议全拷贝）
   - tailwind.config.* / postcss.config.*（如模板缺失也要拷）
3. 运行
   - `npm install`
   - `npm run dev`

## 关键依赖（用于排查平台依赖缺失）
- react / react-dom
- recharts
- papaparse
- jszip
- html-to-image
- framer-motion
- lucide-react
- tailwindcss / postcss / autoprefixer

