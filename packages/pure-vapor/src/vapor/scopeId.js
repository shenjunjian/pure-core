import { isArray } from '@vue/shared'
import { isVaporComponent } from './component.js'
import { isFragment } from './fragment.js'

export function setScopeId(block, scopeIds) {
  if (block instanceof Element) {
    for (let i = 0; i < scopeIds.length; i++) {
      block.setAttribute(scopeIds[i], '')
    }
  } else if (isVaporComponent(block)) {
    setScopeId(block.block, scopeIds)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      setScopeId(block[i], scopeIds)
    }
  } else if (isFragment(block)) {
    setScopeId(block.nodes, scopeIds)
  }
}

/**
 * 在子组件挂载后，把「继承来的」scopeId 写到其根 block 对应 DOM 的空属性上，
 * 让父级 scoped CSS（例如 `[data-v-parent] .title`）能命中子组件根节点。
 *
 * 两个相关字段的来源不同：
 *
 * - `instance.type.__scopeId`：组件**自身**的 scope，来自 SFC 编译（`script.__scopeId = 'data-v-xxx'`），
 *   并作为 compiler 的 `scopeId` 选项写进本组件 template 生成的元素（见 transformElement）。
 * - `instance.scopeId`：实例**创建瞬间**的外层 scope 快照，在 VaporComponentInstance 构造里赋值：
 *   `this.scopeId = getCurrentScopeId()`，即 `getScopeOwner()`（`currentSlotOwner || currentInstance`）
 *   的 `type.__scopeId`。根组件或无外层 scope 时为 `undefined`。
 *
 * 调用时机：`mountComponent` 在 `insert(instance.block)` 之后调用本函数。
 *
 * 何时会真正写入 DOM（不满足则直接 return）：
 * - 必须有 `parent`，且 `instance.scopeId` 有值；
 * - 单根子树：`instance.block` 不能是长度大于 1 的数组（多根无法确定要标哪一个根）。
 *
 * 写入哪几个 id：
 * - `parent.type.__scopeId !== instance.scopeId`：说明 `instance.scopeId` 来自插槽宿主等「非直接父」的 scope，
 *   只写入 `instance.scopeId`；插槽侧的 `xxx-s` 由 `createSlot` 单独处理。
 * - 否则写入 `parent.type.__scopeId`（常规父子嵌套）。
 *
 * 示例：Parent 带 `__scopeId: 'parent'`，Child 带 `__scopeId: 'child'`。
 * Parent 的 setup 里 `createComponent(Child)` 时，Child 构造阶段 `getCurrentScopeId()` 为 `'parent'`，
 * 故 `Child.scopeId === 'parent'`。Child 模板编译已在根 `<div>` 上带 `child` 属性；
 * 挂载后本函数再补上 `parent`，最终根节点类似 `<div child parent>`，父级 scoped 规则可作用到子根。
 */
export function setComponentScopeId(instance) {
  const parent = instance.parent
  const scopeId = instance.scopeId
  if (!parent || !scopeId) return

  // 多根 fragment 不在此处理,编译已经有scopeid,比如helloworld组件, 在此直接返回
  if (isArray(instance.block) && instance.block.length > 1) return

  const scopeIds = []
  const parentScopeId = parent && parent.type.__scopeId
  // parentScopeId !== scopeId：scopeId 来自 slot owner 等外层，而非直接父组件自身
  if (parentScopeId !== scopeId) {
    scopeIds.push(scopeId)
  } else {
    if (parentScopeId) scopeIds.push(parentScopeId)
  }

  if (scopeIds.length > 0) {
    setScopeId(instance.block, scopeIds)
  }
}
