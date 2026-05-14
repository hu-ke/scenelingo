# Tasks

## Task 1: 搭建前端基础架构
创建前端页面路由、布局和全局状态管理。

- [x] SubTask 1.1: 创建 `App.tsx` 主组件和 `App.css` 全局样式
- [x] SubTask 1.2: 创建 React Context (`ReviewContext`) 管理审核流程状态（照片队列、当前照片、识别结果、已处理照片列表）
- [x] SubTask 1.3: 创建 `indexedDB.ts` 工具模块，封装 IndexedDB 操作（保存照片、读取所有照片、删除照片）
- [x] SubTask 1.4: 创建简单的客户端路由（首页、审核页、合并预览页），使用 hash 路由或状态切换

**依赖**: 无

---

## Task 2: 实现首页（照片上传入口 + 已处理列表）
- [x] SubTask 2.1: 实现批量照片上传组件（`<input type="file" multiple>` 选择多张照片，读取为 Base64 存入 Context）
- [x] SubTask 2.2: 实现"上传并开始识别"按钮，点击后将照片队列写入 Context 并跳转到审核页
- [x] SubTask 2.3: 实现已处理照片列表（从 IndexedDB 读取，展示缩略图网格）
- [x] SubTask 2.4: 实现空状态提示（无照片时显示引导文案）
- [x] SubTask 2.5: 实现照片删除功能（点击删除按钮，从 IndexedDB 移除并刷新列表）
- [x] SubTask 2.6: 实现多选模式和"合并导出"按钮（选择 ≥2 张后跳转合并预览页）

**依赖**: Task 1

---

## Task 3: 实现审核页（逐张识别 + 标注展示 + 操作按钮）
- [x] SubTask 3.1: 创建 `ReviewPage` 组件，从 Context 获取当前照片，自动调用 `/api/recognize` 识别
- [x] SubTask 3.2: 创建 Canvas 标注绘制组件 `AnnotatedImage`，在照片上绘制矩形框和英文标签（根据识别结果中的 bbox 坐标）
- [x] SubTask 3.3: 实现"重新识别"按钮，重新调用 API 并刷新标注
- [x] SubTask 3.4: 实现"保存"按钮，将当前带标注的照片（Base64）和识别结果存入 IndexedDB，进入下一张
- [x] SubTask 3.5: 实现"跳过"按钮，丢弃当前照片，进入下一张
- [x] SubTask 3.6: 实现审核完成状态展示（全部处理完后显示提示，可返回首页）

**依赖**: Task 1

---

## Task 4: 实现合并预览与导出页
- [x] SubTask 4.1: 创建 `MergePage` 组件，接收选中的照片数据
- [x] SubTask 4.2: 使用 Canvas 将多张带标注的照片拼合为网格布局的大图
- [x] SubTask 4.3: 实现合并预览（在页面中展示合并后的效果）
- [x] SubTask 4.4: 实现"下载导出"按钮，将 Canvas 导出为 PNG 并触发浏览器下载
- [x] SubTask 4.5: 实现返回按钮，回到首页

**依赖**: Task 2

---

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1
- Task 4 依赖 Task 2
- Task 2 与 Task 3 可并行开发（因为 Task 1 完成后两者没有相互依赖）