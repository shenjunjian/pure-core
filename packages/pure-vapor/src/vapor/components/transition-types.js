/**
 * Transition type definitions for pure-vapor.
 * Centralized type declarations to avoid circular dependencies.
 */

/**
 * @typedef {Object} TransitionOptions
 * @property {any} [$key] - transition key for identifying elements
 * @property {VaporTransitionHooks} [$transition] - transition hooks
 */

/**
 * @typedef {Object} VaporTransitionHooks
 * @property {'in-out'|'out-in'|undefined} mode - transition mode
 * @property {boolean} [persisted] - if true, element is not removed during leave (e.g. v-show)
 * @property {boolean} [disabled] - temporarily skip enter/move animations
 * @property {function(Element): void} beforeEnter
 * @property {function(Element, function(): void): void} enter
 * @property {function(Element): void} afterEnter
 * @property {function(Element): void} enterCancelled
 * @property {function(Element): void} beforeLeave
 * @property {function(Element, function(): void): void} leave
 * @property {function(Element): void} afterLeave
 * @property {function(Element): void} leaveCancelled
 * @property {function(import('./block.js').Block, function(TransitionProps, TransitionState, import('../component.js').VaporComponentInstance): void): void} [applyGroup] - for TransitionGroup
 * @property {function(): boolean} [isLeaving]
 * @property {function(): void} [setLeavingNodeCache]
 * @property {function(): void} [unsetLeavingNodeCache]
 * @property {function(): void} [earlyRemove]
 * @property {function(VaporTransitionHooks): VaporTransitionHooks} [cloneHooks]
 * @property {function(Element, function(): void, function(): void): void} [delayedLeave]
 */

/**
 * @typedef {Object} TransitionProps
 * @property {string} [name]
 * @property {string} [type]
 * @property {number|{enter: number, leave: number}} [duration]
 * @property {boolean} [css=true]
 * @property {'in-out'|'out-in'} [mode]
 * @property {boolean} [appear]
 * @property {boolean} [persisted]
 * @property {string} [enterFromClass]
 * @property {string} [enterActiveClass]
 * @property {string} [enterToClass]
 * @property {string} [leaveFromClass]
 * @property {string} [leaveActiveClass]
 * @property {string} [leaveToClass]
 * @property {string} [appearFromClass]
 * @property {string} [appearActiveClass]
 * @property {string} [appearToClass]
 * @property {string} [moveClass]
 * @property {function(Element): void} [onBeforeEnter]
 * @property {function(Element, function(): void): void} [onEnter]
 * @property {function(Element): void} [onAfterEnter]
 * @property {function(Element): void} [onEnterCancelled]
 * @property {function(Element): void} [onBeforeLeave]
 * @property {function(Element, function(): void): void} [onLeave]
 * @property {function(Element): void} [onAfterLeave]
 * @property {function(Element): void} [onLeaveCancelled]
 * @property {function(Element): void} [onBeforeAppear]
 * @property {function(Element, function(): void): void} [onAppear]
 * @property {function(Element): void} [onAfterAppear]
 * @property {function(Element): void} [onAppearCancelled]
 */

/**
 * @typedef {Object} TransitionState
 * @property {boolean} isMounted
 * @property {boolean} isLeaving
 * @property {boolean} isUnmounting
 * @property {Map<any, Record<string, any>>} leavingNodes
 */

/**
 * @typedef {(Element | import('./fragment.js').VaporFragment | import('./fragment.js').DynamicFragment) & TransitionOptions} TransitionBlock
 */

export {}
