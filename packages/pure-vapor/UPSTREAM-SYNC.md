# pure-vapor upstream 同步清单

以 `@vue/runtime-vapor` 为黄金标准，`compiler-vapor` 生成契约为约束。同步时删除 hydration / SSR / vdomInterop / Suspense 路径，保留 CSR else 分支。

## 模块对照表

| runtime-vapor | pure-vapor | 最后同步说明 |
|---------------|------------|--------------|
| `src/index.ts` | `src/index.js` | 导出契约；含 `setStaticTemplateRef` / `setTemplateRefBinding` |
| `src/apiTemplateRef.ts` | `src/vapor/apiTemplateRef.js` | P0 template ref |
| `src/slotBoundary.ts` | `src/vapor/slotBoundary.js` | P0 slot 基础设施 |
| `src/slotFragment.ts` | `src/vapor/slotFragment.js` | P0 slot 状态机 |
| `src/componentSlots.ts` | `src/vapor/componentSlots.js` | P0 slot / forwarded / NON_STABLE |
| `src/block.ts` | `src/vapor/block.js` | `isValidSlot` / `trackSlotBoundaryDirtying` |
| `src/apiCreateIf.ts` | `src/vapor/apiCreateIf.js` | P1 SLOT_ROOT |
| `src/apiCreateFor.ts` | `src/vapor/apiCreateFor.js` | P1 flags / createForSlots |
| `src/apiCreateDynamicComponent.ts` | `src/vapor/apiCreateDynamicComponent.js` | P1 SLOT_ROOT / KeepAlive identity |
| `src/fragment.ts` | `src/vapor/fragment.js` | DynamicFragment / SlotFragment |
| `src/component.ts` | `src/vapor/component.js` | mount / attrs / KeepAlive / Teleport normalizeRawSlots |
| `src/renderEffect.ts` | `src/vapor/renderEffect.js` | render effect 顺序 |
| `src/components/Transition.ts` | `src/vapor/components/Transition.js` | v-show appear / earlyRemove / slot fallback |
| `src/components/TransitionGroup.ts` | `src/vapor/components/TransitionGroup.js` | FLIP / moveClass |
| `src/components/KeepAlive.ts` | `src/vapor/components/KeepAlive.js` | ctx / scope / include-exclude prune |
| `src/components/Teleport.ts` | `src/vapor/components/Teleport.js` | CSR move / defer / CSS vars |
| `src/dom/prop.ts` | `src/vapor/dom/prop.js` | setClassIncremental / parseEventName |
| `src/dom/event.ts` | `src/vapor/dom/event.js` | delegation / disabled |
| `src/scopeId.ts` | `src/vapor/scopeId.js` | 动态根 / fragment scopeId |
| `src/componentProps.ts` | `src/vapor/componentProps.js` | attrs v-once 快照 |
| `src/apiDefineComponent.ts` | `src/vapor/apiDefineComponent.js` | defineVaporComponent 运行时 |
| `src/apiDefineCustomElement.ts` | `src/vapor/apiDefineCustomElement.js` | CSR CE（无 SSR CE） |
| `runtime-dom` VAPOR 段 | `src/internal/baseTransition.js` 等 | Transition DOM 辅助 |

## 明确不同步

- `vdomInterop.ts`、`dom/hydration.ts`、`hydrateFragment.ts`
- `createVaporSSRApp`、Suspense、VDOM 互操作 slot 路径
- `runtime-dom` / `runtime-core` 整包依赖

## 测试移植对照

| runtime-vapor | pure-vapor | 说明 |
|---------------|------------|------|
| `__tests__/dom/prop.spec.ts` | `__tests__/dom/prop.spec.js` | 跳过 hydration |
| `__tests__/scopeId.spec.ts` | `__tests__/scopeId.spec.js` | 跳过 interop |
| `__tests__/componentProps.spec.ts` | `__tests__/componentProps.spec.js` | CSR 子集 |
| `__tests__/components/Transition.spec.ts` | `__tests__/components/Transition.spec.js` | 无 interop/hydration |
| `__tests__/components/TransitionGroup.spec.ts` | `__tests__/components/TransitionGroup.spec.js` | CSR |
| `__tests__/components/KeepAlive.spec.ts` | `__tests__/components/KeepAlive.spec.js` | CSR 子集 |
| `__tests__/components/Teleport.spec.ts` | `__tests__/components/Teleport.spec.js` | CSR 子集 |

## 后续 minor 合并流程

1. 合并官方 `minor` 到本 monorepo。
2. `git log packages/runtime-vapor --since=<上次同步>` 按模块过滤 commit。
3. 对照上表逐文件 diff → 移植 CSR 逻辑 → 删 hydration/interop 分支。
4. 移植或扩展对应 `__tests__`（跳过 interop/hydration describe）。
5. 运行 `vp run build pure-vapor && vp run test pure-vapor`。
6. 更新本表「最后同步说明」列与 `compileSmoke` 快照（若 compiler 生成 import 有变）。
