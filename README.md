# fanren-bili-emo-dashboard (v5)

## v5 新增
- ✅ 增加「模型极性分布（model_emo）」与「Ollama 调用覆盖率」卡片（需要你上传/生成对应 tables）
- ✅ 一键导出图包（zip）：自动打包主要图表 PNG + 自动生成的 `report.md`
- ✅ 自动生成“图注 + 数据概况 + 结论句式”（可直接粘贴到论文第4章/第5章）
- ✅ func 颜色改为 **稳定映射**：同一功能在不同图/不同集颜色一致（更利于论文对比）

## 本地运行
```bash
npm install
npm run dev
```

> 注意：不要直接双击打开 `index.html`（file://）——Vite 项目必须通过开发服务器或 `preview` 方式运行。

## 生成静态站点（可部署）
```bash
npm run build
npm run preview
```

## 在线预览
见 `ONLINE_PREVIEW.md`（可在 CodeSandbox / StackBlitz 导入 zip 预览）。
