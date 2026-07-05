<script setup vapor>
import { ref } from 'vue'
const toggle = ref(false)
</script>
<template>
  <transition name="fade">
    <div v-if="toggle" class="test">content</div>
  </transition>
  <button @click="toggle = !toggle">Toggle</button>
</template>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>