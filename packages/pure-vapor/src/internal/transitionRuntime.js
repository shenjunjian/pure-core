import { leaveCbKey } from './baseTransition.js'
import { queuePostFlushCb } from './scheduler.js'

export const MoveType = {
  ENTER: 0,
  LEAVE: 1,
  REORDER: 2,
}

function needTransition(transition) {
  return transition && !transition.persisted
}

export function performTransitionEnter(
  el,
  transition,
  insert,
  _parentSuspense,
  force = false,
) {
  if (force && transition.persisted && !el[leaveCbKey]) {
    insert()
    return
  }
  if (force || needTransition(transition)) {
    transition.beforeEnter(el)
    insert()
    queuePostFlushCb(() => transition.enter(el))
  } else {
    insert()
  }
}

export function performTransitionLeave(
  el,
  transition,
  remove,
  isElement = true,
  force = false,
) {
  const performRemove = () => {
    remove()
    if (transition && !transition.persisted && transition.afterLeave) {
      transition.afterLeave()
    }
  }

  if (force || (isElement && transition && !transition.persisted)) {
    const { leave, delayLeave } = transition
    const performLeave = () => {
      if (el._isLeaving && force) {
        el[leaveCbKey](true)
      }
      leave(el, performRemove)
    }
    if (delayLeave) {
      delayLeave(el, performRemove, performLeave)
    } else {
      performLeave()
    }
  } else {
    performRemove()
  }
}
