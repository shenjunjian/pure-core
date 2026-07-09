import { defineVaporComponent, h } from 'vue'

const HChildLabel = defineVaporComponent({
  props: {
    label: { type: String, required: true },
  },
  setup(props, { slots }) {
    return h('div', { class: 'h-demo-child' }, [
      h('strong', null, () => props.label),
      slots.default ? slots.default() : null,
    ])
  },
})

/** Vapor 子组件：h(Comp, props, default slot) */
export const HComponentDemo = defineVaporComponent({
  props: {
    label: { type: String, required: true },
  },
  setup(props) {
    return h(HChildLabel, { label: () => props.label }, () =>
      h('em', null, ' — default slot via h()'),
    )
  },
})
