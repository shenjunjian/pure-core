import { NOOP, extend, normalizeCssVarValue } from '@vue/shared'
import { onBeforeUpdate, onMounted, onUnmounted } from './lifecycle.js'
import { queuePostFlushCb } from './scheduler.js'
import { warn } from './warning.js'
import { watch } from './watch.js'

export const CSS_VAR_TEXT = Symbol(__DEV__ ? 'CSS_VAR_TEXT' : '')

export function baseUseCssVars(instance, getParentNode, getVars, setVars) {
  if (!instance) {
    if (__DEV__) {
      warn(`useCssVars is called without current active component instance.`)
    }
    return
  }

  if (__DEV__) {
    instance.getCssVars = getVars
  }

  const updateTeleports = (instance.ut = (vars = getVars()) => {
    Array.from(
      document.querySelectorAll(`[data-v-owner="${instance.uid}"]`),
    ).forEach(node => setVarsOnNode(node, vars))
  })

  const applyCssVars = (vars = getVars()) => {
    setVars(vars)
    updateTeleports(vars)
  }

  onBeforeUpdate(() => {
    queuePostFlushCb(applyCssVars)
  })

  onMounted(() => {
    watch(
      () => {
        const vars = getVars()
        extend({}, vars)
        applyCssVars(vars)
      },
      NOOP,
      { flush: 'post' },
    )
    const ob = new MutationObserver(() => applyCssVars())
    ob.observe(getParentNode(), { childList: true })
    onUnmounted(() => ob.disconnect())
  })
}

export function setVarsOnNode(el, vars) {
  if (el.nodeType === 1) {
    const style = el.style
    let cssText = ''
    for (const key in vars) {
      const value = normalizeCssVarValue(vars[key])
      style.setProperty(`--${key}`, value)
      cssText += `--${key}: ${value};`
    }
    style[CSS_VAR_TEXT] = cssText
  }
}
