<script setup lang="ts">
import { ref } from 'vue'
import { useGridStore } from '@/stores/gridStore'
import { useDragHandler } from '@/composables/useDragHandler'

const props = defineProps<{
  type: 'row' | 'column'
  index: number
}>()

const gridStore = useGridStore()
const containerSize = ref(0)

function getContainerSize(target: HTMLElement) {
  const gridContainer = target.closest('.photo-grid-wrapper')
  if (gridContainer) {
    containerSize.value =
      props.type === 'row' ? gridContainer.clientHeight : gridContainer.clientWidth
  }
}

// Use composable for drag handling - incremental delta variant
const { startDrag, isDragging } = useDragHandler({
  onStart: (event) => {
    getContainerSize(event.originalEvent.target as HTMLElement)
  },
  onMove: (delta) => {
    // Use the appropriate axis delta based on resize type
    const axisDelta = props.type === 'row' ? delta.y : delta.x
    const deltaPercent = (axisDelta / containerSize.value) * 100

    if (props.type === 'row') {
      gridStore.updateRowHeight(props.index, deltaPercent)
    } else {
      gridStore.updateColumnWidth(props.index, deltaPercent)
    }
  },
})
</script>

<template>
  <div
    class="resize-handle"
    :class="[`resize-handle--${type}`, { 'resize-handle--active': isDragging }]"
    @mousedown="startDrag"
    @touchstart="startDrag"
  />
</template>

<style scoped>
.resize-handle {
  position: absolute;
  z-index: 10;
  background-color: transparent;
  transition: background-color 0.2s;
  touch-action: none; /* Prevent scrolling when dragging on mobile */
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

/* Larger touch targets on mobile */
@media (max-width: 767px) {
  .resize-handle--row {
    height: 16px;
  }

  .resize-handle--column {
    width: 16px;
  }

  /* Show a subtle indicator so users know handles exist */
  .resize-handle {
    background-color: rgba(24, 144, 255, 0.15);
  }

  .resize-handle:active,
  .resize-handle--active {
    background-color: rgba(24, 144, 255, 0.5);
  }
}
</style>
