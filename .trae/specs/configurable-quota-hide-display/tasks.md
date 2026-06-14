# Tasks

- [x] Task 1: 后端 — 定义配额常量并统一引用
  - [x] 在 `auth.py` 顶部定义 `DEFAULT_RECOGNITION_QUOTA = 10` 和 `SHARE_REWARD_QUOTA = 10`
  - [x] `get_or_create_user` 中 `"recognition_quota": 10` 改为 `DEFAULT_RECOGNITION_QUOTA`
  - [x] `get_or_create_user_by_openid` 中 `"recognition_quota": 10` 改为 `DEFAULT_RECOGNITION_QUOTA`
  - [x] `main.py` 中导入 `SHARE_REWARD_QUOTA`，替换 `add_user_quota(inviter_id, 10)` 和 `"quota_added": 10`

- [x] Task 2: 前端 — 移除配额展示，文案去硬编码
  - [x] 移除 FAB 按钮中的 `<View className="home-fab-quota">` 配额角标
  - [x] 将 Toast 文案 `'获得 10 次识别机会！'` 改为 `'获得额外识别机会！'`
  - [x] 将弹窗文案 `'分享给好友，即可获得 10 次识别机会！'` 改为 `'分享给好友，即可获得额外识别机会！'`
  - [x] 保留内部 `quota` 状态和 `fetchQuota` 逻辑不变（用于判断配额是否用尽）

# Task Dependencies
- Task 1 和 Task 2 可并行执行