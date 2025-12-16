<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Upload, Button, Spin, message } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons-vue'
import heic2any from 'heic2any'
import type { GridCell } from '@/types/grid'
import { useGridStore } from '@/stores/gridStore'

const props = defineProps<{
  cell: GridCell
  isLastInColumn: boolean
  isLastInRow: boolean
}>()

const gridStore = useGridStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const positionStart = ref({ x: 50, y: 50 })
const cellRef = ref<HTMLElement | null>(null)

const cellStyle = computed(() => ({
  gridRow: `${props.cell.row} / span ${props.cell.rowSpan}`,
  gridColumn: `${props.cell.col} / span ${props.cell.colSpan}`,
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

async function processImageFile(file: File): Promise<{ file: File; url: string }> {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')

  if (isHeic) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
      })
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
      if (!blob) {
        throw new Error('Failed to convert HEIC image')
      }
      const convertedFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), {
        type: 'image/jpeg',
      })
      return {
        file: convertedFile,
        url: URL.createObjectURL(blob),
      }
    } catch (error) {
      console.error('HEIC conversion failed:', error)
      message.error('Could not convert HEIC file. Try converting to JPEG first, or use a different photo.')
      throw error
    }
  }

  return {
    file,
    url: URL.createObjectURL(file),
  }
}

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

// Image positioning functions - always draggable
const imageStyle = computed(() => ({
  objectPosition: `${props.cell.imagePosition.x}% ${props.cell.imagePosition.y}%`,
}))

function handlePositionMouseDown(event: MouseEvent) {
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  positionStart.value = { ...props.cell.imagePosition }
  event.preventDefault()
}

function handlePositionMouseMove(event: MouseEvent) {
  if (!isDragging.value || !cellRef.value) return

  const cellRect = cellRef.value.getBoundingClientRect()
  const deltaX = event.clientX - dragStart.value.x
  const deltaY = event.clientY - dragStart.value.y

  // Convert pixel delta to percentage (inverted because we're moving the focal point)
  const percentDeltaX = -(deltaX / cellRect.width) * 100
  const percentDeltaY = -(deltaY / cellRect.height) * 100

  const newX = positionStart.value.x + percentDeltaX
  const newY = positionStart.value.y + percentDeltaY

  gridStore.updateCellImagePosition(props.cell.id, newX, newY)
}

function handlePositionMouseUp() {
  isDragging.value = false
}

// Touch event handlers for mobile
function handleTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  const touch = event.touches[0]
  if (!touch) return
  isDragging.value = true
  dragStart.value = { x: touch.clientX, y: touch.clientY }
  positionStart.value = { ...props.cell.imagePosition }
}

function handleTouchMove(event: TouchEvent) {
  if (!isDragging.value || !cellRef.value || event.touches.length !== 1) return
  const touch = event.touches[0]
  if (!touch) return

  const cellRect = cellRef.value.getBoundingClientRect()
  const deltaX = touch.clientX - dragStart.value.x
  const deltaY = touch.clientY - dragStart.value.y

  const percentDeltaX = -(deltaX / cellRect.width) * 100
  const percentDeltaY = -(deltaY / cellRect.height) * 100

  const newX = positionStart.value.x + percentDeltaX
  const newY = positionStart.value.y + percentDeltaY

  gridStore.updateCellImagePosition(props.cell.id, newX, newY)
  event.preventDefault() // Prevent scrolling while dragging
}

function handleTouchEnd() {
  isDragging.value = false
}
</script>

<template>
  <div
    ref="cellRef"
    class="grid-cell"
    :style="{ ...cellStyle, ...borderStyle }"
    @mousemove="handlePositionMouseMove"
    @mouseup="handlePositionMouseUp"
    @mouseleave="handlePositionMouseUp"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Loading overlay -->
    <div v-if="isProcessing" class="loading-overlay">
      <Spin size="large" />
    </div>

    <!-- Delete button - always visible on mobile, hover on desktop -->
    <Button
      class="delete-btn"
      type="primary"
      danger
      shape="circle"
      size="small"
      @click="handleDelete"
    >
      <template #icon><DeleteOutlined /></template>
    </Button>

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
        @mousedown="handlePositionMouseDown"
        @touchstart="handleTouchStart"
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
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Desktop: show on hover */
@media (min-width: 768px) {
  .grid-cell:hover .delete-btn {
    opacity: 1;
  }
}

/* Mobile: always visible but subtle */
@media (max-width: 767px) {
  .delete-btn {
    opacity: 0.7;
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
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: grab;
  touch-action: none; /* Prevent scrolling when dragging on mobile */
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
