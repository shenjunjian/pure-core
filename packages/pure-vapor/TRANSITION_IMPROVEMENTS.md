# Transition 组件改进说明

## 改进内容

根据你的反馈,已对 Transition 组件迁移进行了以下改进:

### 1. 类型定义重组 ✅

**问题**: 之前将 Transition 相关类型定义放在 `block.js` 中不合理

**解决方案**: 
- 创建独立的 [`transition-types.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/components/transition-types.js) 文件
- 集中管理所有 Transition 相关的 JSDoc 类型定义
- `block.js` 通过 `@typedef {import(...)}` 引用这些类型
- 保留了核心的 `Block` / `BlockFn` 类型在 `block.js`(因为它们是整个 vapor 运行时的基础)

**优势**:
- ✅ 避免循环依赖
- ✅ 类型定义靠近实际使用的地方
- ✅ 更清晰的模块职责划分
- ✅ 便于维护和更新

### 2. 完整 FLIP 动画支持 ✅

**问题**: 之前移除了 FLIP 高级特性

**解决方案**:
- 创建 [`transition-flip.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/components/transition-flip.js) 模块
- 从 runtime-dom 完整移植 FLIP 动画逻辑
- 包含以下核心功能:

#### FLIP 工具函数清单

| 函数 | 功能 | 说明 |
|------|------|------|
| `recordPosition(el)` | 记录元素初始位置 | First - 记录 DOM 更新前的位置 |
| `recordNewPosition(el)` | 记录元素新位置 | Last - 记录 DOM 更新后的位置 |
| `applyTranslation(oldEl, newEl)` | 应用平移变换 | Invert - 计算并应用 transform |
| `baseApplyTranslation(oldPos, newPos, el)` | 核心平移逻辑 | 处理 scale 因子,避免变形 |
| `hasCSSTransform(el, root, moveClass)` | CSS transition 检测 | 检测元素是否有 transform transition |
| `handleMovedChildren(el, moveClass)` | Move 动画处理 | Play - 添加 move class 并设置清理回调 |
| `callPendingCbs(el)` | 调用待处理回调 | 清除之前的 move/enter 回调 |
| `forceReflow(el)` | 强制浏览器重排 | 确保 transform 立即应用 |

#### FLIP 工作原理

```
First (初始状态)
  ↓ recordPosition() 记录每个元素的 getBoundingClientRect()
  
DOM 更新 (列表重排)
  ↓ 浏览器重新布局
  
Last (最终状态)  
  ↓ recordNewPosition() 记录新位置
  
Invert (反转)
  ↓ applyTranslation() 计算位移差
  ↓ 应用 transform: translate(dx, dy) 让元素"回到"原位
  ↓ transitionDuration = '0s' 禁用过渡
  
Play (播放)
  ↓ forceReflow() 强制重排
  ↓ 清除 transform,让元素自然移动到新位置
  ↓ 添加 moveClass,触发 CSS transition
  ↓ transitionend 事件后清理 class
```

#### Scale 因子处理

FLIP 实现中包含精确的 scale 因子计算,以处理父元素有 transform 的情况:

```javascript
// 计算 scale 因子
let scaleX = rect.width / el.offsetWidth
let scaleY = rect.height / el.offsetHeight

// 避免除零和噪声
if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1
if (Math.abs(scaleX - 1) < 0.01) scaleX = 1

// 应用时除以 scale 因子
s.transform = `translate(${dx / scaleX}px, ${dy / scaleY}px)`
```

这确保了即使元素在缩放的容器中,动画也能正确执行。

### 3. TransitionGroup 完整实现

[`TransitionGroup.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/components/TransitionGroup.js) 现在包含:

- ✅ **beforeUpdate 钩子**: 
  - 遍历所有子元素
  - 跳过隐藏元素 (`display: none`)
  - 记录初始位置
  - 禁用 transitions 避免干扰测量

- ✅ **updated 钩子**:
  - 检测 CSS transform support (`hasCSSTransform`)
  - 调用 pending callbacks (`callPendingCbs`)
  - 记录新位置
  - 应用平移变换
  - 强制重排
  - 添加 move class 并设置清理

- ✅ **完整的错误处理**:
  - Dev mode key 警告
  - Mode prop 无效警告
  - Connected element 检查

## 文件结构

```
packages/pure-vapor/src/vapor/components/
├── Transition.js              # VaporTransition 组件
├── TransitionGroup.js         # VaporTransitionGroup 组件 (完整 FLIP)
├── TransitionUtils.js         # Block 解析工具
├── transition-types.js        # ✨ 新增: 类型定义
└── transition-flip.js         # ✨ 新增: FLIP 工具函数
```

## 使用示例

### 基础列表过渡

```javascript
import { VaporTransitionGroup } from 'pure-vapor'
import { ref } from '@vue/reactivity'

const items = ref([1, 2, 3])

return () => VaporTransitionGroup(
  {
    tag: 'ul',
    name: 'list',
    moveClass: 'list-move',  // CSS class for move animation
  },
  {
    default: () => items.value.map((item, index) => {
      const li = createElement('li')
      li.textContent = item
      li.$key = index  // Required!
      return li
    })
  }
)
```

### CSS 样式

```css
/* Enter/Leave transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

/* Move transition */
.list-move {
  transition: transform 0.5s ease;
}
```

### 动态排序示例

```javascript
const shuffle = () => {
  items.value = items.value.sort(() => Math.random() - 0.5)
  // FLIP will automatically animate the reordering!
}
```

## 性能考虑

FLIP 动画的性能优化:

1. **只在需要时检测**: `hasCSSTransform` 只在第一个 connected child 上测试
2. **跳过隐藏元素**: `display: none` 的元素不参与 FLIP
3. **批量处理**: 所有位置记录和变换应用在同一个渲染周期
4. **自动清理**: `transitionend` 事件后自动移除 move class
5. **Callback 管理**: `callPendingCbs` 确保不会有泄漏的回调

## 与 runtime-dom 的对比

| 特性 | runtime-dom | pure-vapor | 状态 |
|------|------------|------------|------|
| FLIP 位置测量 | ✅ | ✅ | ✅ 完整保留 |
| Scale 因子计算 | ✅ | ✅ | ✅ 完整保留 |
| CSS Transform 检测 | ✅ | ✅ | ✅ 完整保留 |
| Move class 管理 | ✅ | ✅ | ✅ 完整保留 |
| Pending callbacks | ✅ | ✅ | ✅ 完整保留 |
| VNode interop | ✅ | ❌ | ❌ 按设计移除 |
| SSR hydration | ✅ | ❌ | ❌ 按设计移除 |

## 总结

✅ **类型定义已重组**: 移到专门的 `transition-types.js`,避免污染 `block.js`  
✅ **FLIP 已完整保留**: 包括所有高级特性和精确的动画计算  
✅ **代码质量提升**: 模块化更好,职责更清晰  
✅ **文档已更新**: [`TRANSITION_MIGRATION.md`](file://d:/WORK/pure-core/packages/pure-vapor/TRANSITION_MIGRATION.md) 反映最新状态  

---

**改进日期**: 2026-07-04  
**基于反馈**: 类型定义位置和 FLIP 特性完整性
