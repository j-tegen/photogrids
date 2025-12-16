<script setup lang="ts">
import { ref, computed } from 'vue'
import { Upload, Button, Slider, Segmented, Space, Card, message } from 'ant-design-vue'
import {
  UploadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ZoomInOutlined,
} from '@ant-design/icons-vue'
import { useSplitterStore } from '@/stores/splitterStore'
import { exportSplits, loadImage, type ExportFormat } from '@/utils/splitterExport'
import { MIN_SPLIT_COUNT, MAX_SPLIT_COUNT, MIN_ZOOM, MAX_ZOOM } from '@/types/splitter'
import { processImageFile } from '@/utils/imageProcessing'

const props = defineProps<{
  exportFormat: ExportFormat
}>()

const splitterStore = useSplitterStore()

const isExporting = ref(false)
const isProcessing = ref(false)
const imageRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Crop drag state
const isDraggingCrop = ref(false)
const dragType = ref<'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const cropStart = ref({ x: 0, y: 0, width: 100, height: 100 })

// Position drag state
const isDraggingPosition = ref(false)
const positionDragStart = ref({ x: 0, y: 0 })
const positionStart = ref({ x: 0, y: 0 })

const splitCountOptions = computed(() => {
  const options = []
  for (let i = MIN_SPLIT_COUNT; i <= MAX_SPLIT_COUNT; i++) {
    options.push({ value: i, label: String(i) })
  }
  return options
})

const imageTransformStyle = computed(() => ({
  transform: `rotate(${splitterStore.rotation}deg) scale(${splitterStore.zoom}) translate(${splitterStore.position.x}%, ${splitterStore.position.y}%)`,
}))

const cropAreaStyle = computed(() => ({
  left: `${splitterStore.cropArea.x}%`,
  top: `${splitterStore.cropArea.y}%`,
  width: `${splitterStore.cropArea.width}%`,
  height: `${splitterStore.cropArea.height}%`,
}))

// Generate split line positions
const splitLines = computed(() => {
  const lines = []
  for (let i = 1; i < splitterStore.splitCount; i++) {
    lines.push((i / splitterStore.splitCount) * 100)
  }
  return lines
})

async function beforeUpload(file: File) {
  isProcessing.value = true
  try {
    const { file: processedFile, url } = await processImageFile(file)
    splitterStore.setImage(processedFile, url)
  } catch {
    // Error already shown
  } finally {
    isProcessing.value = false
  }
  return false
}

function handleZoomChange(value: number | [number, number]) {
  if (typeof value === 'number') {
    splitterStore.setZoom(value)
  }
}

function handleSplitCountChange(value: string | number) {
  if (typeof value === 'number') {
    splitterStore.setSplitCount(value)
  }
}

// Crop handle drag handlers
function startCropDrag(event: MouseEvent | TouchEvent, type: typeof dragType.value) {
  event.preventDefault()
  event.stopPropagation()
  isDraggingCrop.value = true
  dragType.value = type

  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY

  dragStart.value = { x: clientX, y: clientY }
  cropStart.value = { ...splitterStore.cropArea }

  document.addEventListener('mousemove', handleCropDrag)
  document.addEventListener('mouseup', stopCropDrag)
  document.addEventListener('touchmove', handleCropDrag, { passive: false })
  document.addEventListener('touchend', stopCropDrag)
}

function handleCropDrag(event: MouseEvent | TouchEvent) {
  if (!isDraggingCrop.value || !containerRef.value) return
  event.preventDefault()

  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY

  const rect = containerRef.value.getBoundingClientRect()
  const deltaX = ((clientX - dragStart.value.x) / rect.width) * 100
  const deltaY = ((clientY - dragStart.value.y) / rect.height) * 100

  const newCrop = { ...cropStart.value }

  switch (dragType.value) {
    case 'move':
      newCrop.x = Math.max(0, Math.min(100 - newCrop.width, cropStart.value.x + deltaX))
      newCrop.y = Math.max(0, Math.min(100 - newCrop.height, cropStart.value.y + deltaY))
      break
    case 'n':
      newCrop.y = Math.max(0, Math.min(cropStart.value.y + cropStart.value.height - 10, cropStart.value.y + deltaY))
      newCrop.height = cropStart.value.height - (newCrop.y - cropStart.value.y)
      break
    case 's':
      newCrop.height = Math.max(10, Math.min(100 - cropStart.value.y, cropStart.value.height + deltaY))
      break
    case 'e':
      newCrop.width = Math.max(10, Math.min(100 - cropStart.value.x, cropStart.value.width + deltaX))
      break
    case 'w':
      newCrop.x = Math.max(0, Math.min(cropStart.value.x + cropStart.value.width - 10, cropStart.value.x + deltaX))
      newCrop.width = cropStart.value.width - (newCrop.x - cropStart.value.x)
      break
    case 'ne':
      newCrop.y = Math.max(0, Math.min(cropStart.value.y + cropStart.value.height - 10, cropStart.value.y + deltaY))
      newCrop.height = cropStart.value.height - (newCrop.y - cropStart.value.y)
      newCrop.width = Math.max(10, Math.min(100 - cropStart.value.x, cropStart.value.width + deltaX))
      break
    case 'nw':
      newCrop.y = Math.max(0, Math.min(cropStart.value.y + cropStart.value.height - 10, cropStart.value.y + deltaY))
      newCrop.height = cropStart.value.height - (newCrop.y - cropStart.value.y)
      newCrop.x = Math.max(0, Math.min(cropStart.value.x + cropStart.value.width - 10, cropStart.value.x + deltaX))
      newCrop.width = cropStart.value.width - (newCrop.x - cropStart.value.x)
      break
    case 'se':
      newCrop.height = Math.max(10, Math.min(100 - cropStart.value.y, cropStart.value.height + deltaY))
      newCrop.width = Math.max(10, Math.min(100 - cropStart.value.x, cropStart.value.width + deltaX))
      break
    case 'sw':
      newCrop.height = Math.max(10, Math.min(100 - cropStart.value.y, cropStart.value.height + deltaY))
      newCrop.x = Math.max(0, Math.min(cropStart.value.x + cropStart.value.width - 10, cropStart.value.x + deltaX))
      newCrop.width = cropStart.value.width - (newCrop.x - cropStart.value.x)
      break
  }

  splitterStore.setCropArea(newCrop)
}

function stopCropDrag() {
  isDraggingCrop.value = false
  dragType.value = null
  document.removeEventListener('mousemove', handleCropDrag)
  document.removeEventListener('mouseup', stopCropDrag)
  document.removeEventListener('touchmove', handleCropDrag)
  document.removeEventListener('touchend', stopCropDrag)
}

// Position drag handlers (drag image to pan)
function startPositionDrag(event: MouseEvent | TouchEvent) {
  // Only start if not on a crop handle
  if ((event.target as HTMLElement).closest('.crop-handle')) return

  event.preventDefault()
  isDraggingPosition.value = true

  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY

  positionDragStart.value = { x: clientX, y: clientY }
  positionStart.value = { ...splitterStore.position }

  document.addEventListener('mousemove', handlePositionDrag)
  document.addEventListener('mouseup', stopPositionDrag)
  document.addEventListener('touchmove', handlePositionDrag, { passive: false })
  document.addEventListener('touchend', stopPositionDrag)
}

function handlePositionDrag(event: MouseEvent | TouchEvent) {
  if (!isDraggingPosition.value || !containerRef.value) return
  event.preventDefault()

  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY

  const rect = containerRef.value.getBoundingClientRect()
  const deltaX = ((clientX - positionDragStart.value.x) / rect.width) * 50
  const deltaY = ((clientY - positionDragStart.value.y) / rect.height) * 50

  splitterStore.setPosition(positionStart.value.x + deltaX, positionStart.value.y + deltaY)
}

function stopPositionDrag() {
  isDraggingPosition.value = false
  document.removeEventListener('mousemove', handlePositionDrag)
  document.removeEventListener('mouseup', stopPositionDrag)
  document.removeEventListener('touchmove', handlePositionDrag)
  document.removeEventListener('touchend', stopPositionDrag)
}

async function handleExport() {
  if (!splitterStore.imageUrl) return

  isExporting.value = true
  try {
    const image = await loadImage(splitterStore.imageUrl)

    await exportSplits({
      image,
      rotation: splitterStore.rotation,
      zoom: splitterStore.zoom,
      position: splitterStore.position,
      cropArea: splitterStore.cropArea,
      splitCount: splitterStore.splitCount,
      format: props.exportFormat,
    })

    message.success(`Exported ${splitterStore.splitCount} split images`)
  } catch (error) {
    console.error('Export failed:', error)
    message.error('Failed to export images')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="photo-splitter">
    <!-- Controls Bar -->
    <Card class="controls-card">
      <Space wrap>
        <Upload
          :show-upload-list="false"
          :before-upload="beforeUpload"
          accept="image/*,.heic,.heif"
        >
          <Button :loading="isProcessing">
            <template #icon><UploadOutlined /></template>
            Upload Photo
          </Button>
        </Upload>

        <Button
          :disabled="!splitterStore.hasImage"
          @click="splitterStore.rotateCounterClockwise"
        >
          <template #icon><RotateLeftOutlined /></template>
        </Button>

        <Button
          :disabled="!splitterStore.hasImage"
          @click="splitterStore.rotateClockwise"
        >
          <template #icon><RotateRightOutlined /></template>
        </Button>

        <div class="zoom-control">
          <ZoomInOutlined />
          <Slider
            :value="splitterStore.zoom"
            :min="MIN_ZOOM"
            :max="MAX_ZOOM"
            :step="0.1"
            :disabled="!splitterStore.hasImage"
            style="width: 100px"
            @change="handleZoomChange"
          />
          <span class="zoom-value">{{ splitterStore.zoom.toFixed(1) }}x</span>
        </div>

        <Button :disabled="!splitterStore.hasImage" @click="splitterStore.reset">
          <template #icon><ReloadOutlined /></template>
          Reset
        </Button>
      </Space>
    </Card>

    <!-- Image Canvas Area -->
    <Card class="canvas-card">
      <div
        v-if="!splitterStore.hasImage"
        class="upload-placeholder"
      >
        <Upload
          :show-upload-list="false"
          :before-upload="beforeUpload"
          accept="image/*,.heic,.heif"
          class="upload-dragger-full"
        >
          <div class="upload-content">
            <UploadOutlined class="upload-icon" />
            <p>Click or drag an image here</p>
          </div>
        </Upload>
      </div>

      <div
        v-else
        ref="containerRef"
        class="image-container"
        @mousedown="startPositionDrag"
        @touchstart="startPositionDrag"
      >
        <img
          ref="imageRef"
          :src="splitterStore.imageUrl ?? undefined"
          :style="imageTransformStyle"
          class="splitter-image"
          alt="Image to split"
        />

        <!-- Crop Area Overlay -->
        <div class="crop-overlay">
          <div class="crop-area" :style="cropAreaStyle">
            <!-- Crop handles -->
            <div class="crop-handle n" @mousedown="(e) => startCropDrag(e, 'n')" @touchstart="(e) => startCropDrag(e, 'n')" />
            <div class="crop-handle s" @mousedown="(e) => startCropDrag(e, 's')" @touchstart="(e) => startCropDrag(e, 's')" />
            <div class="crop-handle e" @mousedown="(e) => startCropDrag(e, 'e')" @touchstart="(e) => startCropDrag(e, 'e')" />
            <div class="crop-handle w" @mousedown="(e) => startCropDrag(e, 'w')" @touchstart="(e) => startCropDrag(e, 'w')" />
            <div class="crop-handle ne" @mousedown="(e) => startCropDrag(e, 'ne')" @touchstart="(e) => startCropDrag(e, 'ne')" />
            <div class="crop-handle nw" @mousedown="(e) => startCropDrag(e, 'nw')" @touchstart="(e) => startCropDrag(e, 'nw')" />
            <div class="crop-handle se" @mousedown="(e) => startCropDrag(e, 'se')" @touchstart="(e) => startCropDrag(e, 'se')" />
            <div class="crop-handle sw" @mousedown="(e) => startCropDrag(e, 'sw')" @touchstart="(e) => startCropDrag(e, 'sw')" />

            <!-- Move handle in center -->
            <div class="crop-move" @mousedown="(e) => startCropDrag(e, 'move')" @touchstart="(e) => startCropDrag(e, 'move')" />

            <!-- Split lines preview -->
            <div
              v-for="(linePos, index) in splitLines"
              :key="index"
              class="split-line"
              :style="{ left: `${linePos}%` }"
            />
          </div>
        </div>
      </div>
    </Card>

    <!-- Split Controls & Export -->
    <Card class="export-card">
      <div class="export-controls">
        <div class="split-count-control">
          <span class="label">Split into:</span>
          <Segmented
            :value="splitterStore.splitCount"
            :options="splitCountOptions"
            :disabled="!splitterStore.hasImage"
            @change="handleSplitCountChange"
          />
          <span class="label">pieces</span>
        </div>

        <Button
          type="primary"
          size="large"
          :disabled="!splitterStore.hasImage"
          :loading="isExporting"
          @click="handleExport"
        >
          <template #icon><DownloadOutlined /></template>
          Export {{ splitterStore.splitCount }} {{ exportFormat.toUpperCase() }}s
        </Button>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.photo-splitter {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}

.controls-card :deep(.ant-card-body) {
  padding: 12px 16px;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-value {
  min-width: 40px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.canvas-card :deep(.ant-card-body) {
  padding: 0;
  min-height: 400px;
}

.upload-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: #fafafa;
}

.upload-dragger-full {
  width: 100%;
  height: 100%;
}

.upload-dragger-full :deep(.ant-upload) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.upload-content {
  text-align: center;
  color: #999;
  cursor: pointer;
  padding: 40px;
}

.upload-content:hover {
  color: #1890ff;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
}

.image-container {
  position: relative;
  overflow: hidden;
  min-height: 400px;
  max-height: 600px;
  background: #1a1a1a;
  cursor: grab;
}

.image-container:active {
  cursor: grabbing;
}

.splitter-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.crop-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.crop-area {
  position: absolute;
  border: 2px solid #1890ff;
  background: transparent;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

.crop-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #fff;
  border: 2px solid #1890ff;
  border-radius: 2px;
  pointer-events: auto;
  touch-action: none;
}

.crop-handle.n {
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}

.crop-handle.s {
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.crop-handle.e {
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: e-resize;
}

.crop-handle.w {
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: w-resize;
}

.crop-handle.ne {
  top: -8px;
  right: -8px;
  cursor: ne-resize;
}

.crop-handle.nw {
  top: -8px;
  left: -8px;
  cursor: nw-resize;
}

.crop-handle.se {
  bottom: -8px;
  right: -8px;
  cursor: se-resize;
}

.crop-handle.sw {
  bottom: -8px;
  left: -8px;
  cursor: sw-resize;
}

.crop-move {
  position: absolute;
  inset: 16px;
  cursor: move;
  pointer-events: auto;
}

.split-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    #ff4d4f 0,
    #ff4d4f 8px,
    transparent 8px,
    transparent 16px
  );
  transform: translateX(-50%);
  pointer-events: none;
}

.export-card :deep(.ant-card-body) {
  padding: 16px;
}

.export-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.split-count-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label {
  color: rgba(0, 0, 0, 0.65);
}

@media (max-width: 767px) {
  .photo-splitter {
    padding: 12px;
  }

  .controls-card :deep(.ant-card-body) {
    padding: 8px 12px;
  }

  .zoom-control {
    width: 100%;
    justify-content: center;
  }

  .export-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .split-count-control {
    justify-content: center;
  }

  .crop-handle {
    width: 24px;
    height: 24px;
  }

  .crop-handle.n { top: -12px; }
  .crop-handle.s { bottom: -12px; }
  .crop-handle.e { right: -12px; }
  .crop-handle.w { left: -12px; }
  .crop-handle.ne { top: -12px; right: -12px; }
  .crop-handle.nw { top: -12px; left: -12px; }
  .crop-handle.se { bottom: -12px; right: -12px; }
  .crop-handle.sw { bottom: -12px; left: -12px; }
}
</style>
