<script setup lang="ts" vapor>
import { ref } from "vue";

const loadedAt = ref(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
</script>

<template>
  <div class="child-async">
    <strong>异步子组件</strong>
    <span>defineAsyncComponent 加载成功</span>
    <span class="child-async__time">加载时间：{{ loadedAt }}</span>
  </div>
</template>

<style scoped>
.child-async {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px dashed #8b5cf6;
  background: #f5f3ff;
  color: #5b21b6;
  font-size: 14px;
}

.child-async__time {
  font-family: var(--mono);
  font-size: 13px;
  opacity: 0.85;
}
</style>
