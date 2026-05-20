/**
 * Scope id inheritance for VDOM interop (not used in pure-vapor without interop).
 * Returns an empty array — vapor-only trees do not walk VNode parents.
 */
export function getInheritedScopeIds(_vnode, _parentComponent) {
  return []
}
