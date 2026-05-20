import { _child } from './nodeCore.js'

export { _child, _next } from './nodeCore.js'

/*@__NO_SIDE_EFFECTS__*/
export function createElement(tagName) {
  return document.createElement(tagName)
}

/*@__NO_SIDE_EFFECTS__*/
export function createTextNode(value = '') {
  return document.createTextNode(value)
}

/*@__NO_SIDE_EFFECTS__*/
export function createComment(data) {
  return document.createComment(data)
}

/*@__NO_SIDE_EFFECTS__*/
export function querySelector(selectors) {
  return document.querySelector(selectors)
}

/* @__NO_SIDE_EFFECTS__ */
export function parentNode(node) {
  return node.parentNode
}

/*@__NO_SIDE_EFFECTS__*/
export function txt(node) {
  return _child(node)
}

/*@__NO_SIDE_EFFECTS__*/
export function child(node) {
  return _child(node)
}

/*@__NO_SIDE_EFFECTS__*/
export function nthChild(node, i) {
  return node.childNodes[i]
}

/*@__NO_SIDE_EFFECTS__*/
export function next(node) {
  return node.nextSibling
}
