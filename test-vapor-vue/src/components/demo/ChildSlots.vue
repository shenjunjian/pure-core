<script setup lang="ts" vapor>
defineProps<{
  item?: string;
}>();

defineSlots<{
  default(): unknown;
  header(): unknown;
  item(props: { text: string }): unknown;
}>();
</script>

<template>
  <div class="child-slots">
    <header v-if="$slots.header" class="child-slots__header">
      <slot name="header" />
    </header>
    <main class="child-slots__main">
      <slot />
    </main>
    <footer v-if="$slots.item" class="child-slots__scoped">
      <slot name="item" :text="item ?? 'scoped-default'" />
    </footer>
  </div>
</template>
