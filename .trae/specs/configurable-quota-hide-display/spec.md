# 配额数值集中配置 & 隐藏配额展示 Spec

## Why
当前"10次"配额数值散落在后端3处（用户创建×2、分享奖励×1）和前端3处（初始状态、Toast、弹窗文案），改动一处容易遗漏。同时配额数字直接展示在页面 FAB 按钮上给用户造成压力。需要将数值集中到常量定义，并仅在配额耗尽时才提醒用户。

## What Changes
- 后端 `auth.py` 定义 `DEFAULT_RECOGNITION_QUOTA` 和 `SHARE_REWARD_QUOTA` 常量，用户创建和分享奖励统一引用
- 后端 `main.py` 分享奖励接口引用 `SHARE_REWARD_QUOTA` 常量
- 前端移除 FAB 按钮上的配额角标展示，仅保留内部 `quota` 状态用于逻辑判断
- 前端 Toast 和弹窗文案中的硬编码"10"替换为通用表述或动态值

## Impact
- Affected specs: `recognition-quota-share-reward`
- Affected code: `backend/auth.py`、`backend/main.py`、`miniprogram/src/pages/home/index.tsx`

## MODIFIED Requirements

### Requirement: 用户识图配额
系统 SHALL 为每个用户维护一个 `recognition_quota` 字段，初始值由 `DEFAULT_RECOGNITION_QUOTA` 常量（auth.py）定义，可在单处修改即可全局生效。

### Requirement: 分享奖励机制
分享奖励配额由 `SHARE_REWARD_QUOTA` 常量（auth.py）定义，新增奖励时统一引用该常量。

### Requirement: 前端配额展示与引导
前端 SHALL NOT 在页面上持续展示剩余配额数字。仅在配额用尽时（用户点击拍照按钮或上传返回403）弹出提示引导分享。
- 配额用尽弹窗文案使用通用表述「分享给好友，即可获得额外识别机会」
- 分享奖励成功 Toast 文案使用通用表述「获得额外识别机会！」
- 不再展示 FAB 配额角标

#### Scenario: 配额未用尽时无任何展示
- **WHEN** 用户还有剩余配额
- **THEN** 页面上不展示任何配额相关信息

#### Scenario: 配额用尽时弹出引导
- **WHEN** 用户配额为 0 且点击拍照按钮
- **THEN** 弹出引导弹窗，提示分享获取额外机会