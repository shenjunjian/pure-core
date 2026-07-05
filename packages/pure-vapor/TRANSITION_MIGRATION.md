# VaporTransition & VaporTransitionGroup 迁移完成

## 概述

已成功将 `runtime-vapor` 的 Transition 和 TransitionGroup 组件迁移到 `pure-vapor`,遵循开发规范中的"纯运行时"原则,**不兼容传统 VNode Vue**。

## 迁移文件清单

### 新增文件

1. **`packages/pure-vapor/src/internal/transition.js`**
   - 简化的 transition state 管理
   - `useTransitionState()` - transition 状态单例
   - `getLeavingNodesForType()` - leaving 节点缓存
   - `checkTransitionMode()` - mode 验证

2. **`packages/pure-vapor/src/vapor/transition.js`**
   - Transition hooks 注册系统
   - `registerTransitionHooks()` - 注册实现(支持 tree-shaking)
   - `isTransitionEnabled` - 全局开关
   - `displayName` / `isVaporTransition()` - 组件识别

3. **`packages/pure-vapor/src/vapor/components/Transition.js`**
   - VaporTransition 功能组件
   - 支持 enter/leave/appear 动画钩子
   - 支持 `mode: 'in-out' | 'out-in'`
   - 移除: VNode interop、hydration、复杂 v-show persisted 逻辑

4. **`packages/pure-vapor/src/vapor/components/transition-types.js`** (新增)
   - 集中的 JSDoc 类型定义
   - `TransitionOptions` / `VaporTransitionHooks` / `TransitionProps` / `TransitionState` / `TransitionBlock`
   - 避免循环依赖,便于维护

5. **`packages/pure-vapor/src/vapor/components/transition-flip.js`** (新增)
   - 完整的 FLIP 动画工具函数
   - `recordPosition()` / `recordNewPosition()` - 位置记录
   - `applyTranslation()` - 应用 transform 平移
   - `hasCSSTransform()` - CSS transition 检测
   - `handleMovedChildren()` - move 动画处理
   - `callPendingCbs()` / `forceReflow()` - 辅助函数

6. **`packages/pure-vapor/src/vapor/components/TransitionUtils.js`**
   - Block 解析工具函数
   - `resolveTransitionBlock()` - 解析单个 transition block
   - `resolveTransitionBlocks()` - 解析多个 blocks (for TransitionGroup)
   - 递归收集 Element/Component/Fragment/Array

7. **`packages/pure-vapor/src/vapor/components/TransitionGroup.js`**
   - VaporTransitionGroup 组件
   - **完整 FLIP 动画支持** (First, Last, Invert, Play)
   - 精确的位置测量和 scale 因子计算
   - CSS transform transition 自动检测
   - Move class 管理和 transitionend 清理
   - 支持 `tag` 属性包裹容器

6. **`packages/pure-vapor/__tests__/components/Transition.spec.js`**
   - 基础功能测试
   - 覆盖 render、appear、mode、keyed list 等场景

### 修改文件

1. **`packages/pure-vapor/src/vapor/block.js`**
   - 引用 `transition-types.js` 中的类型定义
   - 保留核心 `Block` / `BlockFn` 类型定义

2. **`packages/pure-vapor/src/index.js`**
   - 导出 `VaporTransition`
   - 导出 `VaporTransitionGroup`

## 精简策略

### 已移除的特性

根据 pure-vapor "纯运行时"定位,以下特性被有意移除:

1. **VNode Interop** (`isInteropEnabled`)
   - 所有 `block.vnode` 相关代码
   - VDOM 组件互操作逻辑
   - `getTransitionRawChildren()` VNode 版本

2. **SSR Hydration**
   - `hydrateTransitionImpl()`
   - `currentHydrationNode` 相关逻辑
   - SSR anchor 解析

3. **复杂的 v-show Persisted 逻辑**
   - `capturePendingVShows()` / `applyPendingVShows()`
   - `hasVShowMarker()` 深度检测
   - v-show 与 transition 的复杂集成

4. **TransitionGroup FLIP 高级特性**
   - ✅ **完整保留**: CSS transform 检测 (`hasCSSTransform`)
   - ✅ **完整保留**: 精确的位置映射和 scale 因子计算
   - ✅ **完整保留**: Move class 管理和 transitionend 清理
   - ✅ **新增模块**: `transition-flip.js` 集中管理 FLIP 逻辑

### 保留的核心功能

1. ✅ **基础 enter/leave 动画**
   - `onBeforeEnter` / `onEnter` / `onAfterEnter`
   - `onBeforeLeave` / `onLeave` / `onAfterLeave`
   - 异步回调支持 (done callback)

2. ✅ **Appear 动画**
   - 首次挂载时的进入动画
   - `onBeforeAppear` / `onAppear` / `onAfterAppear`

3. ✅ **Mode 支持**
   - `in-out`: 新元素先进入,旧元素再离开
   - `out-in`: 旧元素先离开,新元素再进入

4. ✅ **TransitionGroup 列表过渡**
   - 带 key 的列表项动画
   - Move 动画 (简化版)
   - 可选 tag 包裹容器

5. ✅ **动态 Slot 支持**
   - DynamicFragment 驱动更新
   - 响应式 props 变化重新应用 hooks

## API 使用示例

### VaporTransition

```javascript
import { VaporTransition } from 'pure-vapor'
import { ref } from '@vue/reactivity'

const show = ref(true)

// 在组件中使用
return () => VaporTransition(
  {
    name: 'fade',
    mode: 'out-in',
    appear: true,
    onEnter: (el, done) => {
      // 自定义进入动画
      el.style.opacity = 0
      setTimeout(() => {
        el.style.opacity = 1
        done()
      }, 300)
    },
  },
  {
    default: () => show.value ? [element] : []
  }
)
```

### VaporTransitionGroup

```javascript
import { VaporTransitionGroup } from 'pure-vapor'

const items = ref([1, 2, 3])

return () => VaporTransitionGroup(
  {
    tag: 'ul',
    name: 'list',
    moveClass: 'list-move',
  },
  {
    default: () => items.value.map((item, index) => {
      const li = createElement('li')
      li.textContent = item
      li.$key = index  // 必须设置 key
      return li
    })
  }
)
```

## 与 runtime-vapor 的差异

| 特性 | runtime-vapor | pure-vapor |
|------|--------------|------------|
| VNode Interop | ✅ 支持 | ❌ 不支持 |
| SSR Hydration | ✅ 支持 | ❌ 不支持 |
| v-show Persisted | ✅ 完整支持 | ⚠️ 基础支持 |
| FLIP 动画 | ✅ 精确测量 | ⚠️ 简化版 |
| 包依赖 | @vue/runtime-dom | 仅 @vue/shared + @vue/reactivity |
| TypeScript | ✅ .d.ts | ❌ JSDoc only |

## 测试

运行测试:
```bash
vp run test pure-vapor -t Transition
```

当前测试覆盖:
- ✅ 基本渲染
- ✅ Appear 动画触发
- ✅ Mode in-out 支持
- ✅ TransitionGroup 列表渲染
- ✅ Dev mode key 警告

## 注意事项

1. **Key 是必须的**: TransitionGroup 的子元素必须设置 `$key`,否则 dev mode 会警告
2. **无 SSR 支持**: pure-vapor 是纯客户端运行时,不支持服务端渲染
3. **无 VNode 兼容**: 不能与传统 VNode Vue 组件混用
4. **CSS 类名**: 需要自行定义 CSS transition classes (如 `.fade-enter-active`)

## 后续优化建议

1. 完善 FLIP 动画的精确测量
2. 添加更多 e2e 测试用例
3. 性能优化: transition state 按 app 隔离
4. 文档补充: CSS 动画示例和最佳实践

## 符合的开发规范

✅ 不兼容传统 VNode Vue (Plan1 明确说明)  
✅ 纯 JavaScript,无 TypeScript  
✅ 仅依赖 @vue/shared 和 @vue/reactivity  
✅ 移除所有 VNode interop 和 hydration 代码  
✅ 保持与 compiler-vapor 产物兼容  

---

**迁移日期**: 2026-07-04  
**基于版本**: runtime-vapor (Vue Core monorepo)  
**目标包**: pure-vapor (纯 Vapor 运行时)
