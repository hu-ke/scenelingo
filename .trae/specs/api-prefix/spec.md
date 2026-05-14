# API 路径前缀 `/scenelingo-service` 规格说明

## Why
后端接口需要统一加上 `/scenelingo-service` 前缀，以适配反向代理/网关路由规则。

## What Changes
- 后端 `main.py`：所有 `@app.get/post/delete` 路径添加 `/scenelingo-service` 前缀
- 前端 `api.ts`：`BASE_URL` 或请求路径添加 `/scenelingo-service` 前缀

## Impact
- Affected specs: login-oss-storage, scene-english-learning
- Affected code:
  - `backend/main.py` — 6 个路由路径加前缀
  - `frontend/src/utils/api.ts` — BASE_URL 加前缀
  - `frontend/src/pages/ReviewPage.tsx` — API calls 如果有独立调用（目前只有 `api.sendCode/verify` 等已通过 api.ts）