<script setup vapor>
import {
  ref,
  onMounted,
  getCurrentInstance,
  isVaporComponent,
  isFragment,
  DynamicFragment,
} from 'vue'
import SimpleChild from './components/SimpleChild.vue'
import MultiRoot from './components/MultiRoot.vue'
import SlotHost from './components/SlotHost.vue'

const showIf = ref(true)
const fragKey = ref(0)
const items = ref(['苹果', '香蕉', '樱桃'])
const useSlotContent = ref(true)

const expectedTypes = [
  'Node',
  'VaporFragment',
  'DynamicFragment',
  'VaporComponentInstance',
  'Block[]',
  'ForBlock',
  'SlotFragment',
  'ForFragment',
]

const foundTypes = ref([])
const missingTypes = ref([])

function classifyBlock(block, types = new Set()) {
  if (!block) return types

  if (block instanceof Node) {
    types.add('Node')
    return types
  }

  if (isVaporComponent(block)) {
    types.add('VaporComponentInstance')
    classifyBlock(block.block, types)
    return types
  }

  if (Array.isArray(block)) {
    types.add('Block[]')
    for (let i = 0; i < block.length; i++) {
      classifyBlock(block[i], types)
    }
    return types
  }

  if (isFragment(block)) {
    if (block.__isTeleportFragment) {
      types.add('VaporFragment')
    } else if (block.isSlot) {
      types.add('SlotFragment')
    } else if (block.itemRef !== undefined) {
      types.add('ForBlock')
    } else if (block.constructor.name === 'ForFragment') {
      types.add('ForFragment')
    } else if (
      block.constructor.name === 'DynamicFragment' ||
      block instanceof DynamicFragment ||
      block.keyed
    ) {
      types.add('DynamicFragment')
    } else {
      types.add('VaporFragment')
    }

    classifyBlock(block.nodes, types)
  }

  return types
}

onMounted(() => {
  const instance = getCurrentInstance()
  if (!instance) return

  const types = classifyBlock(instance.block)
  const found = expectedTypes.filter(type => types.has(type))
  foundTypes.value = found
  missingTypes.value = expectedTypes.filter(type => !types.has(type))

  console.group('[blocks demo] 编译后 Block 类型', instance.block)
  console.log('发现:', [...types].sort())
  console.log('期望覆盖:', expectedTypes)
  console.log('缺失:', missingTypes.value)
  console.groupEnd()
})
</script>

<template>
  <!-- 多根模板：render 返回 Block[]，各动态结构作为根级兄弟节点 -->
  <h1 class="demo-title">Vapor Block 类型演示</h1>

  <p class="intro">
    模板编译后覆盖全部 Block 形态。动态结构放在根级，便于在 instance.block 中检测。
  </p>

  <aside class="inspector">
    <h2>运行时 Block 类型检测</h2>
    <ul class="type-list found">
      <li v-for="type in foundTypes" :key="type">{{ type }}</li>
    </ul>
    <p v-if="missingTypes.length" class="missing">
      未检测到：{{ missingTypes.join('、') }}
    </p>
    <p v-else class="ok">已覆盖全部 8 种 Block 类型</p>
  </aside>

  <!-- Node -->
  <p class="demo-label" data-block="Node">Node — 静态 DOM 节点</p>

  <!-- Block[] -->
  <p class="demo-label" data-block="Block[]">Block[] — 多根组件</p>
  <MultiRoot />

  <!-- VaporComponentInstance -->
  <p class="demo-label" data-block="VaporComponentInstance">
    VaporComponentInstance — 子组件
  </p>
  <SimpleChild label="子组件实例" />

  <!-- DynamicFragment (v-if) -->
  <p class="demo-label" data-block="DynamicFragment">DynamicFragment — v-if</p>
  <button type="button" class="demo-btn" @click="showIf = !showIf">
    切换 v-if 分支
  </button>
  <p v-if="showIf" class="branch-if">v-if 分支</p>
  <p v-else class="branch-else">v-else 分支</p>

  <!-- DynamicFragment (keyed) -->
  <p class="demo-label" data-block="DynamicFragment-keyed">
    DynamicFragment — keyed fragment
  </p>
  <button type="button" class="demo-btn" @click="fragKey++">
    更换 key ({{ fragKey }})
  </button>
  <template :key="fragKey">
    <p class="keyed-frag">keyed fragment 内容</p>
  </template>

  <!-- ForFragment + ForBlock -->
  <p class="demo-label" data-block="ForFragment / ForBlock">
    ForFragment + ForBlock — v-for
  </p>
  <template v-for="(item, index) in items" :key="item">
    <p class="for-item">{{ index + 1 }}. {{ item }}</p>
  </template>

  <!-- SlotFragment -->
  <p class="demo-label" data-block="SlotFragment">SlotFragment — slot</p>
  <button type="button" class="demo-btn" @click="useSlotContent = !useSlotContent">
    {{ useSlotContent ? '使用父级插槽' : '使用 fallback' }}
  </button>
  <SlotHost v-if="useSlotContent">
    <template #default="{ msg }">
      <em class="slot-content">父级插槽：{{ msg }}</em>
    </template>
    <template #extra>
      <strong class="slot-extra-content">父级 extra 插槽</strong>
    </template>
  </SlotHost>
  <SlotHost v-else />

  <!-- VaporFragment (Teleport) -->
  <p class="demo-label" data-block="VaporFragment">
    VaporFragment — TeleportFragment
  </p>
  <div id="teleport-target" class="teleport-target"></div>
  <Teleport to="#teleport-target">
    <p class="teleported">Teleport 内容</p>
  </Teleport>
</template>

<style>
.demo-title,
.intro,
.inspector,
.demo-label,
.demo-btn,
.branch-if,
.branch-else,
.keyed-frag,
.for-item,
.slot-host,
.teleport-target,
.teleported,
.multi-root-a,
.multi-root-b,
.simple-child {
  display: block;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}

.demo-title,
.intro,
.inspector,
.demo-label,
.demo-btn,
.branch-if,
.branch-else,
.keyed-frag,
.for-item,
.slot-content,
.slot-extra-content,
.teleport-target,
.teleported {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

.demo-title {
  padding: 24px 24px 0;
}

.intro {
  padding: 0 24px;
  color: #555;
}

.inspector {
  margin: 16px 24px 24px;
  padding: 12px 16px;
  border: 1px solid #c8e6c9;
  border-radius: 8px;
  background: #f1f8e9;
}

.type-list {
  margin: 8px 0;
  padding-left: 20px;
}

.missing {
  color: #c62828;
}

.ok {
  color: #2e7d32;
  font-weight: 600;
}

.demo-label {
  margin: 16px 24px 4px;
  font-weight: 600;
  color: #37474f;
}

.demo-btn {
  margin: 0 24px 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.multi-root-a,
.multi-root-b {
  display: inline-block;
  width: fit-content;
  margin: 0 24px 8px 0;
  padding: 4px 8px;
  border-radius: 4px;
  background: #e3f2fd;
}

.simple-child {
  margin: 0 24px 8px;
  padding: 8px 12px;
  border-left: 3px solid #1976d2;
  background: #e8eaf6;
}

.branch-if,
.branch-else,
.keyed-frag,
.for-item {
  margin: 0 24px 4px;
}

.branch-if {
  color: #1565c0;
}

.branch-else {
  color: #6a1b9a;
}

.slot-host {
  margin: 0 24px 8px;
  padding: 8px 12px;
  border: 1px dashed #ff9800;
}

.slot-content {
  color: #e65100;
}

.teleport-target {
  margin: 0 24px 8px;
  min-height: 40px;
  padding: 8px;
  border: 1px dashed #9e9e9e;
  background: #fafafa;
}

.teleported {
  margin: 0;
  color: #00838f;
}
</style>
