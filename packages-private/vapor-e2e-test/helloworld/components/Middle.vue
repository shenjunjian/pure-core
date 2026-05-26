<script setup vapor>
import HelloWorld from "./HelloWorld.vue";
</script>

<template>
  <HelloWorld some-other-attr="1" >
      <template #default>
        <div>i am slot into HelloWorld</div>
      </template>
    </HelloWorld>
</template>

<style scoped>

   div{
    color: blue;
   }
</style>
