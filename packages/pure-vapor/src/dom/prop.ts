import { toDisplayString } from '@vue/shared'
import type { Block } from '../types'

/**
 * Only called on text nodes!
 * Compiler should also ensure value passed here is already converted by
 * `toDisplayString`
 */
export function setText(el: Text & { $txt?: string }, value: string): void {
  if (el.$txt !== value) {
    el.nodeValue = el.$txt = value
  }
}

/**
 * Used by setDynamicProps only, so need to guard with `toDisplayString`
 */
export function setElementText(
  el: Node & { $txt?: string },
  value: unknown,
): void {
  value = toDisplayString(value)
  if (el.$txt !== value) {
    el.textContent = el.$txt = value as string
  }
}

export function setBlockText(
  block: Block & { $txt?: string },
  value: unknown,
): void {
  value = value == null ? '' : value
  if (block.$txt !== value) {
    setTextToBlock(block, (block.$txt = value as string))
  }
}

function setTextToBlock(block: Block, value: any): void {
  if (block instanceof Node) {
    if (block instanceof Element) {
      block.textContent = value
    }
  } else if (block instanceof Array) {
    // Do nothing for arrays
  }
}

let isOptimized = false

/**
 * Optimize property lookup for cache properties on Element and Text nodes
 */
export function optimizePropertyLookup(): void {
  if (isOptimized) return
  isOptimized = true
  const proto = Element.prototype as any
  proto.$transition = undefined
  proto.$key = undefined
  proto.$fc = proto.$evtclick = undefined
  proto.$root = false
  proto.$html = proto.$cls = proto.$sty = ''
    // Initialize $txt to undefined instead of empty string to ensure setText()
    // properly updates the text node even when the value is empty string.
    // This prevents issues where setText(node, '') would be skipped because
    // $txt === '' would return true, leaving the original nodeValue unchanged.
    ; (Text.prototype as any).$txt = undefined
}