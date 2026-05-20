import { traverse } from '@vue/reactivity'
import { looseEqual } from '@vue/shared'
import { currentInstance } from '../../internal/instance.js'
import { onMounted } from '../../internal/lifecycle.js'
import {
  vModelTextInit,
  vModelTextUpdate,
  vModelCheckboxInit,
  vModelCheckboxUpdate,
  vModelGetValue,
  vModelSelectInit,
  vModelSetSelected,
} from '../../internal/vModel.js'
import { addEventListener } from '../dom/event.js'
import { renderEffect } from '../renderEffect.js'

function ensureMounted(cb) {
  if (currentInstance.isMounted) {
    cb()
  } else {
    onMounted(cb)
  }
}

export function applyTextModel(el, get, set, modifiers = {}) {
  const trim = modifiers.trim
  const number = modifiers.number
  const lazy = modifiers.lazy
  vModelTextInit(el, trim, number, lazy, set)
  ensureMounted(() => {
    let value
    renderEffect(() => {
      vModelTextUpdate(el, value, (value = get()), trim, number, lazy)
    })
  })
}

export function applyCheckboxModel(el, get, set) {
  vModelCheckboxInit(el, set)
  ensureMounted(() => {
    let value
    renderEffect(() => {
      vModelCheckboxUpdate(el, value, traverse((value = get())))
    })
  })
}

export function applyRadioModel(el, get, set) {
  addEventListener(el, 'change', () => set(vModelGetValue(el)))
  ensureMounted(() => {
    let value
    renderEffect(() => {
      if (value !== (value = get())) {
        el.checked = looseEqual(value, vModelGetValue(el))
      }
    })
  })
}

export function applySelectModel(el, get, set, modifiers) {
  vModelSelectInit(el, get(), modifiers && modifiers.number, set)
  ensureMounted(() => {
    renderEffect(() => vModelSetSelected(el, traverse(get())))
  })
}

export function applyDynamicModel(el, get, set, modifiers) {
  let apply = applyTextModel
  if (el.tagName === 'SELECT') {
    apply = applySelectModel
  } else if (el.tagName === 'TEXTAREA') {
    apply = applyTextModel
  } else if (el.type === 'checkbox') {
    apply = applyCheckboxModel
  } else if (el.type === 'radio') {
    apply = applyRadioModel
  }
  apply(el, get, set, modifiers)
}
