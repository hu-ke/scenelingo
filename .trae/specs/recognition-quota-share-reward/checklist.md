# Checklist

- [x] 新用户创建时 `recognition_quota` 默认为 10
- [x] `GET /api/user/quota` 正确返回剩余配额
- [x] `POST /api/photos/upload-pending` 配额 > 0 时正常上传并扣减
- [x] `POST /api/photos/upload-pending` 配额 = 0 时返回 403 错误
- [x] `POST /api/share/reward` 新用户触发时邀请者配额 +10
- [x] `POST /api/share/reward` 同一邀请关系不重复奖励
- [x] `POST /api/share/reward` 老用户（有照片）不触发奖励
- [x] 分享路径包含 `?inviter=<user_id>`
- [x] 首页展示剩余识图次数
- [x] 配额为 0 时点击拍照弹出引导分享弹窗
- [x] 配额为 0 时上传返回 403 并展示 Toast 提示