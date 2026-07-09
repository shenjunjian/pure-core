<script setup lang="ts" vapor></script>

<template>
  <div class="render-child render-child--a">
    <strong>组件 A</strong>
    <span>纯 Vapor 子组件</span>
  </div>
</template>

<style scoped>
.render-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid #3b82f6;
  background: #eff6ff;
  color: #1e40af;
}

.render-child span {
  font-size: 13px;
  opacity: 0.85;
}
</style>
