export let insertionParent
export let insertionAnchor
export let insertionIndex

/** 编译器在创建 block 之前调用，写入上述全局状态
 * 它是 vapor 组件编译产物中的函数，用于记录插入位置信息
 *
 * @eg
 * _setInsertionState(n1, null, 0)
 * const n0 = _createSlot("default", null)
 * _setInsertionState(n3, null, 1)
 * const n2 = _createAssetComponent("Comp")
 */
export function setInsertionState(
  parent,
  anchor,
  logicalIndex = anchor === 0 ? 0 : undefined,
) {
  insertionParent = parent
  insertionIndex = logicalIndex
  if (anchor !== undefined) {
    insertionAnchor = anchor
    if (anchor === 0 && !parent.$fc) {
      parent.$fc = parent.firstChild
    }
  } else {
    insertionAnchor = undefined
  }
}

/** 清空全局状态；每个 block 创建函数入口都会调用 */
export function resetInsertionState() {
  insertionParent = insertionAnchor = insertionIndex = undefined
}
