# Tasks

- [x] Task 1: 在 auth.py 中添加获取用户语言偏好的函数
  - 新增 `get_user_language(email)` 函数，从 MongoDB users 集合读取用户的 `native_lang` 和 `target_lang`
  - 如果用户不存在或未设置语言，返回默认值 `{ nativeLang: "zh", targetLang: "en" }`

- [x] Task 2: 修改 worker.py 使用用户语言偏好
  - 在处理每张照片时，调用 `get_user_language(user_email)` 获取用户语言偏好
  - 使用用户的 `nativeLang` 和 `targetLang` 构建 AI prompt
  - 移除硬编码的 `build_prompt("zh", "en")`

- [x] Task 3: 验证登录时语言偏好同步
  - 检查 `login/index.tsx` 登录成功后是否正确处理返回的 `nativeLang` 和 `targetLang`
  - 确保语言偏好写入本地存储和全局状态

- [x] Task 4: 验证设置页面语言保存
  - 确认 `settings/index.tsx` 修改语言后调用 `api.updateLanguage` 同步到后端
  - 确认后端 `/api/user/language` 接口正确更新 MongoDB

# Task Dependencies
- Task 2 依赖 Task 1（需要获取用户语言的函数）
- Task 3 和 Task 4 独立，可并行
