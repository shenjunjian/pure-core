<script setup lang="ts" vapor>
withDefaults(
  defineProps<{
    label?: string;
    count?: number;
    active?: boolean;
  }>(),
  {
    label: "默认标签",
    count: 0,
    active: false,
  },
);
</script>

<template>
  <div class="child-props" :class="{ 'child-props--active': active }">
    <span class="child-props__label">{{ label }}</span>
    <span class="child-props__count">count: {{ count }}</span>
    <span class="child-props__status">{{ active ? "active" : "inactive" }}</span>
  </div>
</template>
