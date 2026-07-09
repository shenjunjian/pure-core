<script setup lang="ts" vapor></script>

<template>
  <div class="child-style-deep">
    <p class="child-inner">子组件内部文本（应被父级 :deep 穿透染色）</p>
  </div>
</template>

<style scoped>
.child-style-deep {
  padding: 10px 14px;
  border: 1px dashed var(--border);
  border-radius: 6px;
}
</style>
