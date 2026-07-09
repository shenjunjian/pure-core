import { defineVaporComponent, h } from 'vue'

/** 响应式 props：getter 驱动 class 更新 */
export const HReactivePropsDemo = defineVaporComponent({
  props: {
    className: { type: String, required: true },
  },
  setup(props) {
    return h(
      'div',
      {
        class: () => props.className,
        id: 'h-reactive-props',
      },
      () => `class = "${props.className}"`,
    )
  },
})
