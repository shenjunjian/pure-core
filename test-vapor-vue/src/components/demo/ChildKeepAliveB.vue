<script setup lang="ts" vapor>
import { onActivated, onDeactivated, ref } from "vue";

const emit = defineEmits<{
  lifecycle: [event: "activated" | "deactivated", tab: string];
}>();

const note = ref("");

onActivated(() => emit("lifecycle", "activated", "Tab B"));
onDeactivated(() => emit("lifecycle", "deactivated", "Tab B"));
</script>

<template>
  <div class="keepalive-tab keepalive-tab--b">
    <strong>Tab B</strong>
    <span>onActivated / onDeactivated 会写入事件日志</span>
    <input
      v-model="note"
      type="text"
      class="demo-input"
      placeholder="输入内容后切换 Tab 验证缓存"
    />
  </div>
</template>

<style scoped>
.keepalive-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 2px solid #10b981;
  background: #ecfdf5;
  color: #065f46;
  font-size: 14px;
}
</style>
