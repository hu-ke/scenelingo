# 用户语言设置同步与识图应用 Spec

## Why
当前用户在设置页面选择目标语言（如日语）后，识图结果仍然是英语。原因是后台 worker 处理照片时硬编码使用 `zh` 和 `en`，没有读取用户的语言偏好设置。用户希望设置中选择的目标语言能存到数据库，并在识图时正确应用，实现同一账号在不同端登录共享同一语言设置。

## What Changes
- 修改 `worker.py`：处理照片时根据 `user_email` 从数据库读取用户的 `native_lang` 和 `target_lang`
- 确保用户语言偏好正确存储到 MongoDB users 集合
- 确保登录时正确同步用户的语言偏好到前端

## Impact
- Affected specs: settings-multilang
- Affected code:
  - `backend/worker.py` — 识图时读取用户语言偏好
  - `backend/auth.py` — 确保语言偏好读写正确
  - `miniprogram/src/pages/login/index.tsx` — 登录时同步语言偏好
  - `miniprogram/src/context/AppContext.tsx` — 语言状态管理

## ADDED Requirements

### Requirement: Worker 识图时使用用户语言偏好
系统 SHALL 在后台 worker 处理照片时，根据照片所属用户的语言偏好动态生成 AI prompt。

#### Scenario: 用户设置日语后识图
- **WHEN** 用户在设置中将目标语言设为日语，然后上传照片
- **THEN** 后台 worker 识图时使用日语作为目标语言，返回日语单词和音标

#### Scenario: 用户未设置语言偏好
- **WHEN** 用户从未设置过语言偏好
- **THEN** 使用默认值：母语=中文，目标语言=英语

### Requirement: 语言偏好跨设备同步
系统 SHALL 确保已登录用户的语言偏好存储在数据库中，并在登录时同步到前端。

#### Scenario: 新设备登录同步语言
- **WHEN** 用户在新设备登录
- **THEN** 从数据库读取用户的语言偏好并应用到当前设备

#### Scenario: 设置语言后其他设备同步
- **WHEN** 用户在设备A修改语言设置
- **THEN** 下次在设备B登录时，语言设置已更新

## MODIFIED Requirements

### Requirement: Worker 照片处理流程
修改 `worker.py` 的 `main()` 函数，在处理每张照片时：
1. 根据 `user_email` 查询用户的 `native_lang` 和 `target_lang`
2. 使用用户偏好构建 AI prompt（而非硬编码）

## REMOVED Requirements
无。
