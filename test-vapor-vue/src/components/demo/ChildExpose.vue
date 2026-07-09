<script setup lang="ts" vapor>
import { ref } from "vue";

const internalCount = ref(0);

function reset() {
  internalCount.value = 0;
}

function increment(step = 1) {
  internalCount.value += step;
}

defineExpose({
  internalCount,
  reset,
  increment,
});
</script>

<template>
  <div class="child-expose">
    <span>内部计数: {{ internalCount }}</span>
    <button type="button" class="demo-btn demo-btn--sm" @click="increment()">+1</button>
  </div>
</template>
