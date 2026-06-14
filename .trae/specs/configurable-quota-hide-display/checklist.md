# Checklist

- [x] 后端 `DEFAULT_RECOGNITION_QUOTA` 常量定义且被 `get_or_create_user` 和 `get_or_create_user_by_openid` 引用
- [x] 后端 `SHARE_REWARD_QUOTA` 常量定义且被 `share_reward` 接口引用
- [x] 后端不再有任何硬编码 `"recognition_quota": 10` 字面量
- [x] 前端 FAB 按钮不再展示配额角标
- [x] 前端 Toast/弹窗中不再出现硬编码的 "10次"
- [x] 前端配额用尽弹窗在配额为 0 时仍然正常弹出