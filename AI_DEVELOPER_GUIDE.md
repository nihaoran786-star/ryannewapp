# AI 开发必读指南 (Sora2 Studio Architecture Guide)

- **最后更新时间:** 2024-05
+ **最后更新时间:** 2026-01-10 （与当前系统时间对齐）
- **架构师:** System Architect
+ **维护团队:** Sora2 Frontend Core Team

---

## 🛑 核心原则 (CRITICAL RULES)

1.  **功能冻结协议 (Feature Freeze Protocol)**:
    *   **Sora 视频生成核心 (`DirectorPage`, `soraService`)**: 已进入**成熟稳定期**。严禁修改现有的轮询逻辑、ID提取策略或状态流转代码。任何对 API 调用的修改必须通过新增函数实现，不得触碰 `createVideoTask` 和 `queryVideoTask` 的现有实现。
+   > ⚠️ **违反后果**: 可能导致历史任务无法查询、视频生成中断、用户数据丢失。
    *   **全局上下文 (`GlobalContext`)**: 严禁修改现有的 `channels` 和 `lang` 数据结构。新增全局状态请在 Context 中追加，不要重构现有逻辑。
    *   **UI 风格**: 必须严格保持 "macOS Glassmorphism" 风格。禁止引入 Material UI、AntD 等其他设计语言的组件。

2.  **扩展原则**:
    *   所有新功能页面（如“后期与特效”、“数字人”）必须作为**新的 Page 组件**开发，并在 `Layout.tsx` 中注册路由。
    *   不要在 `DirectorPage.tsx` 中堆砌新功能的逻辑。

---

## 🏗 系统架构 (Architecture Overview)

本项目是一个 **React + Vite + TypeScript** 的单页应用 (SPA)，模拟了商业级 SaaS 的前端架构。

### 1. 技术栈
*   **路由**: `react-router-dom` (HashRouter模式，确保静态部署兼容性)。
*   **状态管理**: React Context API (`GlobalContext`)。不使用 Redux/Zustand，因为应用复杂度目前由 Context 足以覆盖。
*   **样式**: Tailwind CSS + 自定义 macOS 风格配置 (见 `index.html` 中的 `tailwind.config`)。
*   **图标**: `lucide-react`。

### 2. 数据流向
*   **持久化**: 所有用户配置（API Keys, 历史记录, 剧本）均存储在 `localStorage`。没有真实后端数据库。
*   **API 交互**: 前端直接调用第三方 Sora 渠道商 API。
    *   由于不同渠道商 API 格式混乱，`soraService.ts` 承担了**适配器模式**的角色，负责清洗和标准化数据。

---

## 🧩 核心模块详解

### A. 导演工作台 (Director Module)
*   **文件**: `pages/DirectorPage.tsx`, `components/TaskCard.tsx`, `services/soraService.ts`
*   **逻辑**:
    1.  **任务创建**: 用户提交 Prompt -> 调用 `createVideoTask` -> 获取 `apiId` (异步)。
    2.  **轮询机制**: `DirectorPage` 使用 `setInterval` (5秒) 轮询所有状态为 `queued` 或 `processing` 的任务。
    3.  **容错**: `soraService.ts` 包含极其暴力的 ID 查找逻辑（递归查找 JSON），以应对 API 返回结构的不确定性。**绝对不要优化这部分代码，除非你完全理解所有渠道商的返回格式。**

### B. 剧本编辑器 (Script Module)
*   **文件**: `components/ScriptEditor.tsx`, `services/scriptUtils.ts`
*   **逻辑**:
    *   实现了一个轻量级的 **Fountain** 剧本解析器。
    *   **实时解析**: 用户输入文本 -> 正则表达式判断行类型 (场景、角色、对话) -> 生成预览。
    *   **防抖保存**: 编辑内容变化后，延迟 1秒 写入 LocalStorage。

### C. 渠道管理 (Channel Management)
*   **文件**: `context/GlobalContext.tsx`
*   **逻辑**:
    *   支持多节点配置（BaseURL + Token）。
    *   UI 上允许用户切换当前使用的 API 节点，但历史任务会记住它是由哪个节点创建的 (`channelId` 字段)，轮询时会使用对应的节点配置。

---

## 🚀 新功能开发指南

如果你接到任务开发“数字人”功能：
1.  在 `pages/` 下新建 `DigitalHumanPage.tsx`。
2.  在 `types.ts` 中定义相关的数据接口。
3.  在 `services/` 下新建 `digitalHumanService.ts` (不要修改 `soraService.ts`)。
4.  在 `index.tsx` 中配置路由。
5.  **切记**: 复用 `Layout` 组件，保持 UI 一致性。
如果你接到任务开发“数字人”功能：
+   ❌ **绝对禁止**:
+   - 在 `DirectorPage.tsx` 中 import 或调用 `DigitalHumanPage` 相关逻辑
+   - 修改 `GlobalContext` 的 `channels` 结构以适配新功能
+   - 使用 `useState` 在页面组件中存储持久化数据（必须用 `localStorage`）
---

**End of Guide**
