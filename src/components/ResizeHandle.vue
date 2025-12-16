<script setup lang="ts">
import { ref } from 'vue'
import { useGridStore } from '@/stores/gridStore'

const props = defineProps<{
  type: 'row' | 'column'
  index: number
}>()

const gridStore = useGridStore()
const isDragging = ref(false)
const startPos = ref(0)
const containerSize = ref(0)

function handleMouseDown(event: MouseEvent) {
  isDragging.value = true
  startPos.value = props.type === 'row' ? event.clientY : event.clientX

  // Get the parent grid container size
  const gridContainer = (event.target as HTMLElement).closest('.photo-grid-wrapper')
  if (gridContainer) {
    containerSize.value =
      props.type === 'row' ? gridContainer.clientHeight : gridContainer.clientWidth
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return

  const currentPos = props.type === 'row' ? event.clientY : event.clientX
  const delta = currentPos - startPos.value
  const deltaPercent = (delta / containerSize.value) * 100

  if (props.type === 'row') {
    gridStore.updateRowHeight(props.index, deltaPercent)
  } else {
    gridStore.updateColumnWidth(props.index, deltaPercent)
  }

  startPos.value = currentPos
}

function handleMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}
</script>

<template>
  <div
    class="resize-handle"
    :class="[`resize-handle--${type}`, { 'resize-handle--active': isDragging }]"
    @mousedown="handleMouseDown"
  />
</template>

<style scoped>
.resize-handle {
  position: absolute;
  z-index: 10;
  background-color: transparent;
  transition: background-color 0.2s;
}

.resize-handle:hover,
.resize-handle--active {
  background-color: rgba(24, 144, 255, 0.5);
}

.resize-handle--row {
  left: 0;
  right: 0;
  height: 8px;
  cursor: row-resize;
  transform: translateY(-50%);
}

.resize-handle--column {
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  transform: translateX(-50%);
}
</style>
