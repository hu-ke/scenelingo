# Tasks

- [x] Task 1: 后端 — 用户配额字段与数据库操作
  - [x] 在 `auth.py` 的 `get_or_create_user_by_openid` 中为新用户设置 `recognition_quota: 10`
  - [x] 在 `auth.py` 的 `get_or_create_user` 中为新用户设置 `recognition_quota: 10`
  - [x] 新增 `get_user_quota(user_id)` 函数，查询用户剩余配额
  - [x] 新增 `decrement_user_quota(user_id)` 函数，原子扣减配额（仅当 quota > 0 时扣减）
  - [x] 新增 `add_user_quota(user_id, amount)` 函数，增加配额
  - [x] 新增 `record_share_invite(inviter_id, new_user_id)` 函数，记录邀请关系
  - [x] 新增 `is_new_user(user_id)` 函数，判断是否为新用户（无照片）

- [x] Task 2: 后端 — API 接口
  - [x] 新增 `GET /api/user/quota` 接口，返回 `{"quota": number}`
  - [x] 修改 `POST /api/photos/upload-pending`，调用前检查配额，成功后扣减配额
  - [x] 新增 `POST /api/share/reward` 接口，接收 `{"inviter_user_id": string}`，判断当前用户是否为新用户（无照片），若是则奖励邀请者 10 次配额

- [x] Task 3: 前端 — 分享路径携带 inviter 参数
  - [x] 修改 `useShareAppMessage` 的 path 为 `/pages/home/index?inviter=<当前用户ID>`
  - [x] 修改 `useShareTimeline` 的 path 为 `/pages/home/index?inviter=<当前用户ID>`

- [x] Task 4: 前端 — 配额查询与展示
  - [x] 在 `api.ts` 中新增 `getUserQuota()` 方法
  - [x] 在 `api.ts` 中新增 `shareReward(inviterUserId)` 方法
  - [x] 在首页 `index.tsx` 中加载并展示剩余配额（FAB 按钮旁显示配额角标）
  - [x] 在首页中检测 `inviter` 启动参数，调用 `shareReward` 接口

- [x] Task 5: 前端 — 配额用尽引导
  - [x] 在首页点击 FAB 按钮时，检查配额；若为 0，弹出引导弹窗而非直接上传
  - [x] 弹窗包含提示文案和「分享给好友」按钮（`openType="share"`），点击触发微信分享
  - [x] 处理上传接口返回 403 的情况，展示 Toast 提示并刷新配额

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3、Task 4、Task 5 依赖 Task 2（需要后端接口就绪）
- Task 5 依赖 Task 4（需要配额状态）