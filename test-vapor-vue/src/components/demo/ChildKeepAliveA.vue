<script setup lang="ts" vapor>
import { onActivated, onDeactivated, ref } from "vue";

const emit = defineEmits<{
  lifecycle: [event: "activated" | "deactivated", tab: string];
}>();

const localCount = ref(0);

onActivated(() => emit("lifecycle", "activated", "Tab A"));
onDeactivated(() => emit("lifecycle", "deactivated", "Tab A"));
</script>

<template>
  <div class="keepalive-tab keepalive-tab--a">
    <strong>Tab A</strong>
    <span>切换离开后状态会保留（KeepAlive）</span>
    <div class="demo-controls">
      <button type="button" class="demo-btn demo-btn--sm" @click="localCount++">
        本地计数 +1（{{ localCount }}）
      </button>
    </div>
  </div>
</template>

<style scoped>
.keepalive-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 2px solid #3b82f6;
  background: #eff6ff;
  color: #1e40af;
  font-size: 14px;
}
</style>
