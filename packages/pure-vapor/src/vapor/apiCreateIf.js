import { insert } from './block.js'
import { createComment, createTextNode } from './dom/node.js'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState.js'
import { renderEffect } from './renderEffect.js'
import { DynamicFragment } from './fragment.js'

/** 创建 v-if 分支
 * @param {function} condition 条件函数
 * @param {function} b1 条件为 true 时的渲染函数
 * @param {function} b2 条件为 false 时的渲染函数
 * @param {number} blockShape  enum VaporBlockShape { EMPTY = 0, SINGLE_ROOT = 1, MULTI_ROOT = 2, }
 * @param {boolean} once   
 * @param {number} index 索引
 * 
 * once 为 true （生成字符串 'true' ）的条件有两个：

1. v-if 在 v-once 块内部 — context.inVOnce 为 true
2. 条件表达式是静态的 — 调用 isStaticExpression 判断，包括：
   - 字面量常量（ 'true' , 'false' , 'null' ）
   - BindingTypes.LITERAL_CONST 类型的绑定
当 once=true 时，条件在块创建时只计算一次（ apiCreateIf.ts#L38-L46 ）；
否则会创建一个 DynamicFragment 并用 renderEffect 包装，使其具有响应式。
*/
export function createIf(condition, b1, b2, blockShape, once, index) {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  resetInsertionState()

  let frag
  if (once) {
    const ok = condition()
    frag = ok
      ? b1()
      : b2
        ? b2()
        : [__DEV__ ? createComment('if') : createTextNode()]
  } else {
    const keyed = index != null
    frag = __DEV__
      ? new DynamicFragment('if', keyed, false)
      : new DynamicFragment(undefined, keyed, false)
    renderEffect(() => {
      const ok = condition()
      frag.update(ok ? b1 : b2, keyed ? index * 2 + (ok ? 0 : 1) : undefined)
    })
  }

  if (_insertionParent) insert(frag, _insertionParent, _insertionAnchor)
  return frag
}
