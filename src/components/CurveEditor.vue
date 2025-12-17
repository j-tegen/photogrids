<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Segmented } from 'ant-design-vue'
import { usePhotoEditorStore } from '@/stores/photoEditorStore'
import type { CurveChannel } from '@/types/editor'
import { interpolateCurve } from '@/utils/curveUtils'

defineProps<{
  disabled?: boolean
}>()

const editorStore = usePhotoEditorStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const CANVAS_SIZE = 256
const PADDING = 8
const POINT_RADIUS = 6

const isDragging = ref(false)
const dragPointIndex = ref<number | null>(null)

const channelOptions = [
  { value: 'rgb', label: 'RGB' },
  { value: 'red', label: 'R' },
  { value: 'green', label: 'G' },
  { value: 'blue', label: 'B' },
]

const channelColors: Record<CurveChannel, string> = {
  rgb: '#ffffff',
  red: '#ff4d4f',
  green: '#52c41a',
  blue: '#1890ff',
}

const currentPoints = computed(() => editorStore.curves[editorStore.activeCurveChannel])

function handleChannelChange(value: string | number) {
  editorStore.setCurveChannel(value as CurveChannel)
}

function drawCurve() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')!
  const size = CANVAS_SIZE
  const pad = PADDING

  // Clear canvas
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, size + pad * 2, size + pad * 2)

  // Draw grid
  ctx.strokeStyle = '#444'
  ctx.lineWidth = 1

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const pos = pad + (i / 4) * size

    ctx.beginPath()
    ctx.moveTo(pad, pos)
    ctx.lineTo(pad + size, pos)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(pos, pad)
    ctx.lineTo(pos, pad + size)
    ctx.stroke()
  }

  // Draw diagonal reference line
  ctx.strokeStyle = '#555'
  ctx.beginPath()
  ctx.moveTo(pad, pad + size)
  ctx.lineTo(pad + size, pad)
  ctx.stroke()

  // Draw curve for each channel (show all in background, active in foreground)
  const channels: CurveChannel[] = ['red', 'green', 'blue', 'rgb']
  const activeChannel = editorStore.activeCurveChannel

  for (const channel of channels) {
    if (channel === activeChannel) continue // Draw active last

    const points = editorStore.curves[channel]
    const lut = interpolateCurve(points)

    ctx.strokeStyle = channelColors[channel]
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let x = 0; x < 256; x++) {
      const canvasX = pad + (x / 255) * size
      const canvasY = pad + size - ((lut[x] ?? 128) / 255) * size

      if (x === 0) {
        ctx.moveTo(canvasX, canvasY)
      } else {
        ctx.lineTo(canvasX, canvasY)
      }
    }
    ctx.stroke()
  }

  // Draw active channel curve
  const activePoints = currentPoints.value
  const activeLut = interpolateCurve(activePoints)

  ctx.strokeStyle = channelColors[activeChannel]
  ctx.globalAlpha = 1
  ctx.lineWidth = 2
  ctx.beginPath()

  for (let x = 0; x < 256; x++) {
    const canvasX = pad + (x / 255) * size
    const canvasY = pad + size - ((activeLut[x] ?? 128) / 255) * size

    if (x === 0) {
      ctx.moveTo(canvasX, canvasY)
    } else {
      ctx.lineTo(canvasX, canvasY)
    }
  }
  ctx.stroke()

  // Draw control points for active channel
  for (let i = 0; i < activePoints.length; i++) {
    const point = activePoints[i]
    if (!point) continue
    const canvasX = pad + (point.x / 255) * size
    const canvasY = pad + size - (point.y / 255) * size

    ctx.fillStyle = '#fff'
    ctx.strokeStyle = channelColors[activeChannel]
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(canvasX, canvasY, POINT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

function getCanvasCoords(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY

  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  const canvasX = (clientX - rect.left) * scaleX
  const canvasY = (clientY - rect.top) * scaleY

  // Convert to curve coordinates (0-255)
  const curveX = Math.round(((canvasX - PADDING) / CANVAS_SIZE) * 255)
  const curveY = Math.round((1 - (canvasY - PADDING) / CANVAS_SIZE) * 255)

  return {
    x: Math.max(0, Math.min(255, curveX)),
    y: Math.max(0, Math.min(255, curveY)),
  }
}

function findNearestPoint(coords: { x: number; y: number }): number | null {
  const points = currentPoints.value
  const threshold = 15 // pixels in curve space

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    if (!point) continue
    const dx = coords.x - point.x
    const dy = coords.y - point.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < threshold) {
      return i
    }
  }

  return null
}

function handleMouseDown(event: MouseEvent | TouchEvent) {
  event.preventDefault()

  const coords = getCanvasCoords(event)
  if (!coords) return

  const nearestIndex = findNearestPoint(coords)

  if (nearestIndex !== null) {
    // Start dragging existing point
    isDragging.value = true
    dragPointIndex.value = nearestIndex
  } else {
    // Add new point
    editorStore.addCurvePoint(editorStore.activeCurveChannel, coords)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('touchmove', handleMouseMove, { passive: false })
  document.addEventListener('touchend', handleMouseUp)
}

function handleMouseMove(event: MouseEvent | TouchEvent) {
  if (!isDragging.value || dragPointIndex.value === null) return
  event.preventDefault()

  const coords = getCanvasCoords(event)
  if (!coords) return

  editorStore.updateCurvePoint(editorStore.activeCurveChannel, dragPointIndex.value, coords)
}

function handleMouseUp() {
  isDragging.value = false
  dragPointIndex.value = null

  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('touchmove', handleMouseMove)
  document.removeEventListener('touchend', handleMouseUp)
}

function handleDoubleClick(event: MouseEvent) {
  const coords = getCanvasCoords(event)
  if (!coords) return

  const nearestIndex = findNearestPoint(coords)
  if (nearestIndex !== null && nearestIndex > 0 && nearestIndex < currentPoints.value.length - 1) {
    // Remove point (but not first or last)
    editorStore.removeCurvePoint(editorStore.activeCurveChannel, nearestIndex)
  }
}

// Watch for changes and redraw
watch(
  () => [editorStore.curves, editorStore.activeCurveChannel],
  () => drawCurve(),
  { deep: true }
)

onMounted(() => {
  drawCurve()
})
</script>

<template>
  <div ref="containerRef" class="curve-editor">
    <Segmented
      :value="editorStore.activeCurveChannel"
      :options="channelOptions"
      :disabled="disabled"
      size="small"
      class="channel-selector"
      @change="handleChannelChange"
    />

    <div class="canvas-container">
      <canvas
        ref="canvasRef"
        :width="CANVAS_SIZE + PADDING * 2"
        :height="CANVAS_SIZE + PADDING * 2"
        class="curve-canvas"
        :class="{ disabled }"
        @mousedown="!disabled && handleMouseDown($event)"
        @touchstart="!disabled && handleMouseDown($event)"
        @dblclick="!disabled && handleDoubleClick($event)"
      />
    </div>

    <p class="hint">Click to add points. Double-click to remove. Drag to adjust.</p>
  </div>
</template>

<style scoped>
.curve-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.channel-selector {
  align-self: center;
}

.canvas-container {
  display: flex;
  justify-content: center;
}

.curve-canvas {
  width: 100%;
  max-width: 272px;
  height: auto;
  border-radius: 4px;
  cursor: crosshair;
}

.curve-canvas.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  text-align: center;
  margin: 0;
}
</style>
