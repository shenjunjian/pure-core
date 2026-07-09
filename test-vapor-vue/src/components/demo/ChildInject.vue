<script setup lang="ts" vapor>
import { inject } from "vue";

const theme = inject<{ color: string; label: string }>("demoTheme", {
  color: "#888",
  label: "fallback",
});
const count = inject<number>("demoCount", 0);
</script>

<template>
  <div class="child-inject">
    <span>inject theme: {{ theme.label }} ({{ theme.color }})</span>
    <span>inject count: {{ count }}</span>
  </div>
</template>

<style scoped>
.child-inject {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px dashed var(--border);
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-h);
}
</style>
