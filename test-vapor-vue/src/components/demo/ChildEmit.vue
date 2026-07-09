<script setup lang="ts" vapor>
const emit = defineEmits<{
  action: [message: string];
  increment: [];
}>();

let clickCount = 0;

function onClick() {
  clickCount += 1;
  emit("increment");
  emit("action", `clicked ${clickCount} time(s)`);
}
</script>

<template>
  <button type="button" class="demo-btn" @click="onClick">子组件触发事件</button>
</template>
