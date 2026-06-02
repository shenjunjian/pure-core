## ShapeFlags 定义

```typescript
export enum ShapeFlags {
  // ... 其他标志位
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,  // 256
  COMPONENT_KEPT_ALIVE = 1 << 9,          // 512
}
```

## 两个标志位的作用

### 1. `COMPONENT_SHOULD_KEEP_ALIVE`

**作用**：标记组件**应该被 KeepAlive 缓存**，即当前组件是 KeepAlive 的直接子组件，需要参与缓存机制。

**使用场景**：
- 在组件卸载时，runtime 检查此标志位，如果为真，则执行 `deactivate`（停用）操作，而不是真正的 `unmount`（卸载）
- 组件会被移动到 KeepAlive 的缓存容器中，保留其状态

### 2. `COMPONENT_KEPT_ALIVE`

**作用**：标记组件**已经被 KeepAlive 缓存过**，即该组件是从缓存中取出的，不是第一次挂载。

**使用场景**：
- 在组件挂载时，runtime 检查此标志位，如果为真，则执行 `activate`（激活）操作，而不是重新创建组件
- 组件会从缓存容器中恢复到 DOM 中，恢复之前的状态

##   位运算的作用

`&~` 是**位清除操作**，用于清除某个特定的位标志。
`|~` 是**位设置操作**，用于设置某个特定的位标志。   
 