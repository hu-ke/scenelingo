# Checklist

- [x] 语言偏好工具函数 `languagePrefs.ts` 正确定义并导出
- [x] 默认语言为中文母语 + 英语目标语言
- [x] SettingsPage 正确渲染母语和目标语言选择器
- [x] SettingsPage 保存按钮将偏好写入 localStorage
- [x] `AppPage` 类型包含 `'settings'`
- [x] `App.tsx` switch 渲染 SettingsPage 组件
- [x] HomePage header 有设置入口按钮，点击可跳转 Settings
- [x] Settings 页面"返回"按钮回到首页
- [x] 后端 `POST /api/user/language` 端点正确更新 MongoDB
- [x] `auth/verify` 接口返回用户已有的语言偏好
- [x] 前端 `api.updateLanguage()` 调用后端接口
- [x] AI 识别 prompt 根据语言配置动态生成（不再硬编码 English/Chinese）
- [x] AnnotatedImage 组件 TTS lang 从偏好获取
- [x] ReviewPage TTS lang 从偏好获取
- [x] WordDetailPage TTS lang 从偏好获取
- [x] 已登录用户保存语言偏好同步到 MongoDB
- [x] 登录时语言偏好自动恢复到前端
- [x] `npm run build` 通过，无编译错误
