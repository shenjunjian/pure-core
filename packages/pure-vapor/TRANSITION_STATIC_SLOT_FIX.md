# Transition v-if 内容不显示问题 - 最终修复

## 问题现象

即使修复了 DynamicFragment 的 transition 集成，`<transition>` 中的 `v-if` 元素仍然无法显示。

示例：
```vue
<template>
  <transition name="fade">
    <div v-if="toggle" class="test">content</div>
  </transition>
</template>
```

点击按钮切换 `toggle`，但 content 元素始终不可见。

## 根本原因

**Transition 组件在"静态 slot"分支中没有使用 DynamicFragment**。

### 之前的错误实现

```javascript
export const VaporTransition = (props, { slots }) => {
  // ... 
  
  // ❌ 只在动态 slot 时使用 DynamicFragment
  if (instance.rawSlots && instance.rawSlots.$) {
    const frag = new DynamicFragment("transition");
    // ... 正确的 transition 逻辑
    return frag;
  }

  // ❌ 静态 slot 分支：children 只计算一次，不会响应变化！
  const children = (slots.default && slots.default()) || [];
  
  renderEffect(() => {
    // 只是应用 hooks，但 children 本身不会更新
    applyResolvedTransitionHooks(children, appliedHooks);
  });
  
  return children; // 返回的是 setup 时的快照，不会变化
};
```

### 问题分析

1. **`slots.default()` 只在 setup 时调用一次**
   - 当 `toggle = false` 时，返回空数组 `[]`
   - 这个空数组被保存在 `children` 变量中

2. **renderEffect 不会重新执行 slot 函数**
   - `applyResolvedTransitionHooks(children, ...)` 只是给已有的 children 应用 hooks
   - 但 `children` 本身还是那个空数组

3. **返回值是静态的**
   - `return children` 返回的是 setup 时的快照
   - 即使 toggle 变为 true，返回值也不会改变

4. **DynamicFragment.update() 才是关键**
   - 只有调用 `frag.update(slots.default)` 才会重新执行 slot 函数
   - 这会获取最新的 slot 内容（根据当前 toggle 值）
   - 然后触发 enter/leave 动画

## 解决方案

**Transition 必须始终使用 DynamicFragment**，无论 slot 是否动态。

### 修复后的实现

```javascript
export const VaporTransition = (props, { slots }) => {
  ensureTransitionHooksRegistered();

  const instance = getCurrentInstance();
  const state = useTransitionState();
  
  // ... props proxy setup ...

  // ✅ 始终使用 DynamicFragment
  const frag = new DynamicFragment("transition");
  let isMounted = false;

  renderEffect(() => {
    // 设置或更新 transition hooks
    if (!frag.$transition) {
      frag.$transition = resolveTransitionHooks(frag, propsProxy, state, instance);
    } else {
      frag.$transition.mode = resolvedProps.value.mode;
    }

    // ✅ 关键：每次 renderEffect 执行时都调用 update
    // 这会重新执行 slots.default()，获取最新的 slot 内容
    frag.update(slots.default);

    // Handle appear animation
    if (!isMounted && props.appear) {
      const root = resolveTransitionBlock(frag.nodes);
      if (root && root.$transition) {
        const el = getTransitionElement(root);
        if (el) {
          root.$transition.beforeEnter(el);
          queuePostFlushCb(() => root.$transition.enter(el));
        }
      }
    }
    isMounted = true;
  });

  // ✅ 返回 DynamicFragment，它的 nodes 会随 update() 而变化
  return frag;
};
```

### 工作流程

```
初始状态: toggle = false
  ↓
setup() 执行
  ↓
创建 DynamicFragment
  ↓
renderEffect 首次执行
  ↓
frag.update(slots.default) 
  → slots.default() 返回 [] (因为 toggle=false)
  → frag.nodes = []
  ↓
用户点击按钮: toggle = true
  ↓
renderEffect 再次执行（因为 slots.default 依赖 toggle）
  ↓
frag.update(slots.default)
  → slots.default() 返回 [div element] (因为 toggle=true)
  → 检测到变化: wasMounted=false, 现在是 mounted
  → 执行 enter 动画
  → frag.nodes = [div element]
  ↓
div 元素显示在页面上 ✨
```

## 为什么 runtime-vapor 有 `if (instance.rawSlots.$)` 判断？

runtime-vapor 的代码：
```typescript
if (instance.rawSlots.$) {
  // 使用 DynamicFragment
} else {
  // 静态 slot 优化路径
}
```

这个判断的目的是**性能优化**：
- 如果 slot 确定是静态的（没有响应式依赖），可以跳过 DynamicFragment 的开销
- 但在 pure-vapor 中，**我们无法可靠地检测 slot 是否真的静态**

### pure-vapor 的选择

**简化策略：始终使用 DynamicFragment**

原因：
1. ✅ **正确性优先**: 确保所有场景都能正常工作
2. ✅ **代码简单**: 不需要复杂的静态/动态判断逻辑
3. ✅ **与 compiler 解耦**: 不依赖 compiler 提供的元信息
4. ⚠️ **轻微性能损失**: 对于真正静态的 slot 会有额外开销，但可接受

## 关键要点

### 1. DynamicFragment.update() 的作用

```javascript
frag.update(render) {
  // 1. 检查 key 是否变化
  if (key === this.current) return;
  
  // 2. 清理旧分支（带 leave 动画）
  if (wasMounted) {
    removeBranchWithLeave(...);
  }
  
  // 3. 渲染新分支
  this.renderBranch(render, ...);
  
  // 4. 应用 enter 动画
  applyTransitionHooks(this.nodes, ...);
  
  // 5. 插入 DOM
  insert(this.nodes, parent, anchor);
}
```

### 2. renderEffect 的响应式追踪

```javascript
renderEffect(() => {
  // 这个函数会被追踪响应式依赖
  frag.update(slots.default);
  //           ^^^^^^^^^^^^
  //           如果 slot 内部使用了 ref/reactive
  //           当这些依赖变化时，renderEffect 会重新执行
});
```

### 3. v-if 如何触发更新

```vue
<div v-if="toggle">content</div>
```

编译后大致等价于：
```javascript
slots.default = () => {
  return toggle.value ? [createDiv()] : [];
  //     ^^^^^^^^^^^^
  //     这是一个响应式依赖
  //     当 toggle 变化时，slot 函数的返回值会变化
}
```

## 测试验证

现在可以正确工作了：

```vue
<script setup vapor>
import { ref } from 'vue'
const toggle = ref(false)
</script>

<template>
  <transition name="fade">
    <div v-if="toggle" class="test">content</div>
  </transition>
  <button @click="toggle = !toggle">Toggle</button>
</template>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.test {
  padding: 20px;
  background: lightblue;
}
</style>
```

**预期行为**：
1. 初始状态：看不到 content（toggle=false）
2. 点击按钮：content 淡入显示（opacity 0→1）
3. 再点击：content 淡出隐藏（opacity 1→0）

## 相关文件

- [`packages/pure-vapor/src/vapor/components/Transition.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/components/Transition.js#L368-L423) - 修复后的实现
- [`packages/pure-vapor/src/vapor/fragment.js`](file://d:/WORK/pure-core/packages/pure-vapor/src/vapor/fragment.js#L71-L140) - DynamicFragment.update() 实现

## 总结

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| v-if 切换无效 | 静态 slot 分支未使用 DynamicFragment | 始终使用 DynamicFragment |
| content 不显示 | slots.default() 只执行一次 | frag.update() 每次都会重新执行 slot |
| 动画不触发 | 没有调用 applyTransitionHooks | DynamicFragment.renderBranch() 中自动调用 |

**核心原则**：Transition 组件必须通过 DynamicFragment.update() 来驱动 slot 的响应式更新和动画触发。

---

**修复日期**: 2026-07-04  
**问题阶段**: 第二次修复（第一次修复了 DynamicFragment 集成，但未解决静态 slot 问题）  
**影响范围**: 所有 `<transition>` + `v-if` / 响应式 slot 的场景
