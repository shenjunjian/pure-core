<script setup lang="ts" vapor>
defineProps < {
  label: string
} > ()
</script>

<template>
  <div class="simple-child">{{ label }}</div>
</template>
