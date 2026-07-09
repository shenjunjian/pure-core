<script setup lang="ts" vapor></script>

<template>
  <div class="render-child render-child--b">
    <strong>组件 B</strong>
    <span>动态 :is 切换目标</span>
  </div>
</template>

<style scoped>
.render-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid #8b5cf6;
  background: #f5f3ff;
  color: #5b21b6;
}

.render-child span {
  font-size: 13px;
  opacity: 0.85;
}
</style>
