<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Upload, Button, Spin } from 'ant-design-vue'
import { PlusOutlined, MinusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons-vue'
import type { GridCell } from '@/types/grid'
import { useGridStore } from '@/stores/gridStore'
import { processImageFile } from '@/utils/imageProcessing'
import { useDragHandlerCumulative } from '@/composables/useDragHandler'

const props = defineProps<{
  cell: GridCell
  isLastInColumn: boolean
  isLastInRow: boolean
}>()

const gridStore = useGridStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const cellRef = ref<HTMLElement | null>(null)
const positionStart = ref({ x: 50, y: 50 })
const cellDimensions = ref({ width: 0, height: 0 })
let resizeObserver: ResizeObserver | null = null

// Track cell dimensions for manual image sizing
onMounted(() => {
  if (cellRef.value) {
    const rect = cellRef.value.getBoundingClientRect()
    cellDimensions.value = { width: rect.width, height: rect.height }

    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        cellDimensions.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        }
      }
    })
    resizeObserver.observe(cellRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

const cellStyle = computed(() => ({
  gridRow: `${props.cell.row} / span ${props.cell.rowSpan}`,
  gridColumn: `${props.cell.col} / span ${props.cell.colSpan}`,
  backgroundColor: props.cell.imageUrl ? gridStore.backgroundColor : '#f5f5f5',
}))

const borderStyle = computed(() => {
  const { gridLines } = gridStore
  const thickness = `${gridLines.thickness}px`
  const color = gridLines.color
  const border = `${thickness} solid ${color}`

  const styles: Record<string, string> = {}

  if (gridLines.showEdges) {
    if (props.cell.row === 1) styles.borderTop = border
    if (props.cell.col === 1) styles.borderLeft = border
    if (props.isLastInRow) styles.borderRight = border
    if (props.isLastInColumn) styles.borderBottom = border
  }

  if (gridLines.showInnerLines) {
    if (!props.isLastInRow) styles.borderRight = border
    if (!props.isLastInColumn) styles.borderBottom = border
  }

  return styles
})

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    isProcessing.value = true
    try {
      const { file: processedFile, url } = await processImageFile(file)
      gridStore.updateCellImage(props.cell.id, processedFile, url)
    } catch {
      // Error message already shown in processImageFile
    } finally {
      isProcessing.value = false
    }
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleDelete() {
  gridStore.deleteCell(props.cell.id)
}

async function beforeUpload(file: File) {
  isProcessing.value = true
  try {
    const { file: processedFile, url } = await processImageFile(file)
    gridStore.updateCellImage(props.cell.id, processedFile, url)
  } catch {
    // Error message already shown in processImageFile
  } finally {
    isProcessing.value = false
  }
  return false // Prevent default upload behavior
}

// Handle image load to capture natural dimensions
function handleImageLoad(event: Event) {
  const img = event.target as HTMLImageElement
  gridStore.updateCellImageDimensions(props.cell.id, img.naturalWidth, img.naturalHeight)
}

// Image positioning and zoom - manual calculation for proper zoom behavior
const imageStyle = computed(() => {
  const cell = props.cell
  const { width: cellWidth, height: cellHeight } = cellDimensions.value

  // Fallback if dimensions not yet available
  if (!cellWidth || !cellHeight || !cell.imageNaturalWidth || !cell.imageNaturalHeight) {
    return {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      objectPosition: `${cell.imagePosition.x}% ${cell.imagePosition.y}%`,
    }
  }

  const cellAspect = cellWidth / cellHeight
  const imageAspect = cell.imageNaturalWidth / cell.imageNaturalHeight

  // Base scale to fill cell (cover behavior at zoom 1.0)
  let baseScale: number
  if (imageAspect > cellAspect) {
    // Image is wider than cell - scale to match height
    baseScale = cellHeight / cell.imageNaturalHeight
  } else {
    // Image is taller than cell - scale to match width
    baseScale = cellWidth / cell.imageNaturalWidth
  }

  const finalScale = baseScale * cell.zoom
  const imgWidth = cell.imageNaturalWidth * finalScale
  const imgHeight = cell.imageNaturalHeight * finalScale

  // Position based on imagePosition (0-100%)
  // When image is larger than cell, position controls which part is visible
  // When image is smaller, position controls where it sits in the cell
  const left = (cellWidth - imgWidth) * (cell.imagePosition.x / 100)
  const top = (cellHeight - imgHeight) * (cell.imagePosition.y / 100)

  return {
    position: 'absolute' as const,
    width: `${imgWidth}px`,
    height: `${imgHeight}px`,
    left: `${left}px`,
    top: `${top}px`,
  }
})

function handleZoomIn() {
  gridStore.updateCellZoom(props.cell.id, props.cell.zoom + 0.1)
}

function handleZoomOut() {
  gridStore.updateCellZoom(props.cell.id, props.cell.zoom - 0.1)
}

// Use composable for drag handling
const { startDrag: startPositionDrag, isDragging } = useDragHandlerCumulative({
  onStart: () => {
    positionStart.value = { ...props.cell.imagePosition }
  },
  onMove: (delta) => {
    if (!cellRef.value) return

    const cellRect = cellRef.value.getBoundingClientRect()
    // Convert pixel delta to percentage (inverted because we're moving the focal point)
    const percentDeltaX = -(delta.x / cellRect.width) * 100
    const percentDeltaY = -(delta.y / cellRect.height) * 100

    const newX = positionStart.value.x + percentDeltaX
    const newY = positionStart.value.y + percentDeltaY

    gridStore.updateCellImagePosition(props.cell.id, newX, newY)
  },
})
</script>

<template>
  <div
    ref="cellRef"
    class="grid-cell"
    :style="{ ...cellStyle, ...borderStyle }"
  >
    <!-- Loading overlay -->
    <div v-if="isProcessing" class="loading-overlay">
      <Spin size="large" />
    </div>

    <!-- Button column - right side -->
    <div class="cell-buttons">
      <Button
        class="cell-btn delete-btn"
        type="primary"
        danger
        shape="circle"
        size="small"
        @click="handleDelete"
      >
        <template #icon><DeleteOutlined /></template>
      </Button>
      <div class="zoom-buttons">
        <Button
          class="cell-btn zoom-btn"
          shape="circle"
          size="small"
          :disabled="cell.zoom >= 3"
          @click="handleZoomIn"
        >
          <template #icon><PlusOutlined /></template>
        </Button>
        <Button
          class="cell-btn zoom-btn"
          shape="circle"
          size="small"
          :disabled="cell.zoom <= 0.5"
          @click="handleZoomOut"
        >
          <template #icon><MinusOutlined /></template>
        </Button>
      </div>
    </div>

    <!-- Empty state: file picker -->
    <template v-if="!cell.imageUrl">
      <Upload
        :show-upload-list="false"
        :before-upload="beforeUpload"
        accept="image/*,.heic,.heif"
        class="upload-dragger"
      >
        <div class="upload-content">
          <PlusOutlined class="upload-icon" />
          <span class="upload-text">Click to upload</span>
        </div>
      </Upload>
    </template>

    <!-- Filled state: image always draggable to reposition -->
    <template v-else>
      <img
        :src="cell.imageUrl"
        alt="Grid cell image"
        class="cell-image"
        :style="imageStyle"
        :class="{ 'is-dragging': isDragging }"
        @load="handleImageLoad"
        @mousedown="startPositionDrag"
        @touchstart="startPositionDrag"
      />

      <!-- Overlay with replace image button -->
      <div class="cell-overlay">
        <Button type="primary" shape="circle" @click="triggerFileInput">
          <template #icon><EditOutlined /></template>
        </Button>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*,.heic,.heif"
        class="hidden-input"
        @change="handleFileChange"
      />
    </template>
  </div>
</template>

<style scoped>
.grid-cell {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  /* Background color set dynamically via cellStyle */
}

/* Button column - right side */
.cell-buttons {
  position: absolute;
  top: 8px;
  right: 8px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 10;
  pointer-events: none;
}

.cell-btn {
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.2s;
}

.zoom-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Desktop: show buttons on hover */
@media (min-width: 768px) {
  .grid-cell:hover .cell-btn {
    opacity: 1;
  }
}

/* Mobile: show delete, hide zoom buttons */
@media (max-width: 767px) {
  .delete-btn {
    opacity: 0.7;
  }

  .zoom-buttons {
    display: none;
  }
}

.upload-dragger {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-dragger :deep(.ant-upload) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #999;
  cursor: pointer;
  transition: color 0.2s;
}

.upload-content:hover {
  color: #1890ff;
}

.upload-icon {
  font-size: 32px;
}

.upload-text {
  font-size: 14px;
}

.cell-image {
  cursor: grab;
  touch-action: none; /* Prevent scrolling when dragging on mobile */
  /* Size and position set dynamically via imageStyle computed */
}

.cell-image.is-dragging {
  cursor: grabbing;
}

.cell-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none; /* Allow drag events to pass through to image */
}

.cell-overlay :deep(button) {
  pointer-events: auto; /* Keep button clickable */
}

.grid-cell:hover .cell-overlay {
  opacity: 1;
}

.hidden-input {
  display: none;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

</style>
