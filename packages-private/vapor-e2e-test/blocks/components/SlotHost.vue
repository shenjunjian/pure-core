<script setup vapor>
</script>

<template>
  <span class="slot-host-label">Slot 宿主</span>
  <slot :msg="'来自 SlotHost 的 slot props'">
    <span class="slot-fallback">default fallback</span>
  </slot>
  <slot name="extra">
    <span class="slot-extra-fallback">extra fallback</span>
  </slot>
</template>

<style>
.slot-host-label,
.slot-fallback,
.slot-extra-fallback {
  display: block;
  max-width: 720px;
  margin: 0 auto 4px;
  padding: 0 24px;
  font-family: system-ui, sans-serif;
}

.slot-fallback,
.slot-extra-fallback {
  color: #795548;
}
</style>
