export * from '@vue/shared'
export * from '@vue/reactivity'
export const version: string = __VERSION__

export { createVaporApp } from './apiCreateApp'
export type { VaporComponent, Block } from './types'
export { renderEffect } from './renderEffect'
export { createElement, createTextNode, createComment, txt, next, child, nthChild } from './dom/node'
export { template } from './dom/template'
export { setText, setElementText, setBlockText } from './dom/prop'

import './hmr'
