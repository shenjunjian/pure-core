import { Namespaces, TemplateFlags } from '@vue/shared'
import { _child } from './nodeCore.js'
import { createTextNode } from './node.js'

let t

/*@__NO_SIDE_EFFECTS__*/
export function template(html, flags = 0, ns) {
  const root = !!(flags & TemplateFlags.ROOT)
  let node
  return () => {
    if (node) {
      const ret = node.cloneNode(true)
      if (root) ret.$root = true
      return ret
    }

    if (html[0] !== '<') {
      return createTextNode(html)
    }
    t = t || document.createElement('template')
    if (ns) {
      const tag = ns === Namespaces.SVG ? 'svg' : 'math'
      t.innerHTML = `<${tag}>${html}</${tag}>`
      node = _child(_child(t.content))
    } else {
      t.innerHTML = html
      node = _child(t.content)
    }
    const ret = node.cloneNode(true)
    if (root) ret.$root = true
    return ret
  }
}
