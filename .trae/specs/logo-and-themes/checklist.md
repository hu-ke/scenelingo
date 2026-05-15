# Checklist

- [x] AppLogo 组件正确渲染 SVG，使用主题变量颜色
- [x] AppLogo 支持 `size` 和 `animated` props
- [x] favicon.svg 已替换为新 Logo
- [x] LoginPage 使用 `<AppLogo />` 替代 🎓
- [x] SettingsPage 使用 `<AppLogo />` 替代 🎓
- [x] HomePage header 显示 Logo
- [x] theme.ts 定义了 5 套完整主题（暖橙/海蓝/森绿/雅紫/暗夜）
- [x] `setTheme()` 正确写入 CSS 变量到 `:root`
- [x] `getTheme()` 从 localStorage 正确读取
- [x] App.css 的 CSS 变量兼容多主题（暗色模式下仍有合理样式）
- [x] 暗夜主题下所有文字、卡片、输入框、按钮可读
- [x] SettingsPage 有 5 个主题色块，点击可切换
- [x] 当前主题色块有选中高亮
- [x] 主题切换即时生效无需刷新
- [x] 主题偏好写入 localStorage，刷新后保持
- [x] 已登录用户主题保存到 MongoDB
- [x] 登录后主题偏好自动恢复
- [x] `npm run build` 通过，无编译错误