import { defineVaporComponent, h } from 'vue'

const HSlotLayout = defineVaporComponent({
  setup(_, { slots }) {
    return h('div', { class: 'h-demo-slots' }, [
      slots.header
        ? h('header', { class: 'h-demo-slots__header' }, slots.header)
        : null,
      slots.default
        ? h('main', { class: 'h-demo-slots__body' }, slots.default)
        : null,
    ])
  },
})

/** 具名插槽对象：h(Comp, null, { header, default }) */
export const HNamedSlotsDemo = defineVaporComponent({
  setup() {
    return h(HSlotLayout, null, {
      header: () => h('span', null, 'header slot'),
      default: () => h('span', null, 'default slot body'),
    })
  },
})
