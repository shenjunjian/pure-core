<script setup lang="ts" vapor>
defineOptions({
  inheritAttrs: false,
});

defineProps<{
  title: string;
}>();
</script>

<template>
  <div class="child-attrs" v-bind="$attrs">
    <span class="child-attrs__title">{{ title }}</span>
    <span class="child-attrs__hint">attrs 已透传到外层 div</span>
  </div>
</template>
