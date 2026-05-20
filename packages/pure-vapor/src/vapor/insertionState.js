export let insertionParent
export let insertionAnchor
export let insertionIndex

export function setInsertionState(parent, anchor, logicalIndex) {
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

export function resetInsertionState() {
  insertionParent = insertionAnchor = insertionIndex = undefined
}
