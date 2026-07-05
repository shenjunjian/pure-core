# Transition v-if 切换问题修复

## 问题描述

在使用 `<transition>` 包裹 `v-if` 元素时，切换无法正常工作，内容无法显示。

示例代码：
```vue
<template>
  <transition>
    <div v-if="toggle" class="test">content</div>
  </transition>
</template>
```

## 根本原因

pure-vapor 的 **DynamicFragment** 缺少与 Transition 系统的集成。

### 缺失的功能

1. **update() 方法中没有 transition 检查**
   - 没有调用 `deferBranchUpdateDuringLeave()` 来延迟更新（当有 leave 动画时）
   - 没有调用 `removeBranchWithLeave()` 来执行 leave 动画

2. **renderBranch() 方法中没有应用 transition hooks**
   - 新渲染的节点没有应用 enter 动画

3. **缺少必要的导入**
   - 没有从 `transition.js` 导入相关函数

## 修复方案

### 1. 添加 transition 导入

在 `fragment.js` 中添加：
```javascript
import { 
  isTransitionEnabled, 
  deferBranchUpdateDuringLeave, 
  removeBranchWithLeave,
  applyTransitionHooks  // 新增
} from "./transition.js";
```

### 2. 更新 DynamicFragment.update() 方法

添加了以下逻辑：

```javascript
// 检查 transition 是否启用
const transition = isTransitionEnabled ? this.$transition : undefined;
const wasMounted = this.current !== undefined;

// 调用 onBeforeUpdate hooks
if (wasMounted && this.onBeforeUpdate) {
  for (let i = 0; i < this.onBeforeUpdate.length; i++) {
    this.onBeforeUpdate[i]();
  }
}

// 如果正在 leave 动画中，延迟挂载下一个分支
if (transition && deferBranchUpdateDuringLeave(this, render, key, false)) {
  setActiveSub(prevSub);
  return;
}

// 拆卸之前的分支
if (wasMounted) {
  // ... scope 清理逻辑 ...
  
  // 如果有 transition，尝试带 leave 动画地移除
  if (
    transition &&
    removeBranchWithLeave(this, transition, parent, render, key, false)
  ) {
    // out-in 模式：leave 完成后才挂载下一个分支
    setActiveSub(prevSub);
    return;
  }
  
  if (parent) remove(this.nodes, parent);
}
```

### 3. 更新 renderBranch() 方法

在渲染新节点后应用 transition hooks：

```javascript
const renderBranch = () => {
  this.nodes = this.runWithRenderCtx(() => this.scope.run(render) || [], this.scope) || [];
  
  // ... 其他逻辑 ...
  
  // 如果 transition 启用，应用 transition hooks
  if (isTransitionEnabled && this.$transition) {
    this.$transition = applyTransitionHooks(this.nodes, this.$transition);
  }
};
```

## 工作流程

修复后的完整流程：

```
用户点击按钮切换 toggle
  ↓
v-if 条件变化，slot 返回新的 block（或空数组）
  ↓
DynamicFragment.update() 被调用
  ↓
检查是否有 transition hooks ($transition)
  ↓
如果有且正在 leave 动画中：
  → deferBranchUpdateDuringLeave() 延迟更新
  → 等待 leave 完成后再挂载新分支
  
如果没有 leave 动画或已完成：
  → 清理旧的 scope
  → removeBranchWithLeave() 执行 leave 动画（out-in 模式会延迟返回）
  → 移除旧节点（如果没有动画）
  ↓
renderBranch() 渲染新节点
  ↓
applyTransitionHooks() 应用 enter 动画
  ↓
insert() 插入新节点到 DOM
  ↓
enter 动画播放
```

## Mode 支持

### out-in 模式
```
旧元素开始 leave 动画
  ↓
removeBranchWithLeave() 返回 true，延迟返回
  ↓
leave 动画完成后，回调中挂载新元素
  ↓
新元素执行 enter 动画
```

### in-out 模式
```
新元素立即挂载并执行 enter 动画
  ↓
旧元素同时执行 leave 动画
  ↓
两个动画同时进行
```

### 默认模式（无 mode）
```
旧元素立即移除（无动画）
  ↓
新元素立即挂载并执行 enter 动画
```

## 测试验证

可以使用以下示例测试：

```vue
<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div>
    <transition name="fade">
      <div v-if="toggle" class="box">Content</div>
    </transition>
    <button @click="toggle = !toggle">Toggle</button>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

## 相关文件

- [`packages/pure-vapor/src/vapor/fragment.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/fragment.js) - DynamicFragment 实现
- [`packages/pure-vapor/src/vapor/transition.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/transition.js) - Transition hooks 注册
- [`packages/pure-vapor/src/vapor/components/Transition.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/components/Transition.js) - VaporTransition 组件

## 注意事项

1. **必须使用 DynamicFragment**: Transition 组件内部会使用 DynamicFragment 来处理动态 slot
2. **Transition hooks 必须先注册**: 通过 `ensureTransitionHooksRegistered()` 确保 hooks 已注册
3. **Key 的重要性**: 如果使用 keyed fragments，确保正确设置 `$key`
4. **Mode 的影响**: out-in 模式会显著改变更新时序，需要特别注意

## 与 runtime-vapor 的对齐

此修复使 pure-vapor 的 Transition 行为与 runtime-vapor 完全对齐：

| 特性 | runtime-vapor | pure-vapor (修复前) | pure-vapor (修复后) |
|------|--------------|-------------------|-------------------|
| v-if enter/leave | ✅ | ❌ | ✅ |
| out-in mode | ✅ | ❌ | ✅ |
| in-out mode | ✅ | ❌ | ✅ |
| DynamicFragment 集成 | ✅ | ❌ | ✅ |
| applyTransitionHooks | ✅ | ❌ | ✅ |

---

**修复日期**: 2026-07-04  
**问题来源**: basic-transition.vue e2e 测试用例  
**影响范围**: 所有使用 `<transition>` + `v-if` 的场景
