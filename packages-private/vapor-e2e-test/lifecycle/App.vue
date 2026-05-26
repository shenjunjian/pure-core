<script setup vapor>
import {
  // onBeforeCreate,
  // onCreated,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  onBeforeUpdate,
  onUpdated,
  onBeforeMount,
 onActivated,
 onDeactivated,
 ref
  
} from 'vue'


// onBeforeCreate(() => {
//   console.log('onBeforeCreate')
// })
// onCreated(() => {
//   console.log('onCreated')
// })

onBeforeMount(() => {
  console.log('onBeforeMount')
})

onMounted(() => {
  console.log('onMounted')
})

onBeforeUpdate(() => {
  console.log('onBeforeUpdate')
})

onUpdated(() => {
  console.log('onUpdated')
})

onBeforeUnmount(() => {
  console.log('onBeforeUnmount')
})
onUnmounted(() => {
  console.log('onUnmounted')
})

onActivated(() => {
  console.log('onActivated')
})
onDeactivated(() => {
  console.log('onDeactivated')
})


const count = ref(0)

</script>

<template>
  <section class="todoapp" >
    lifecyle {{ count }} <button @click="count++">count++</button>
  </section>
</template>
