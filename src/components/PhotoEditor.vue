<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Upload,
  Button,
  Slider,
  Collapse,
  Card,
  Space,
  Tag,
  Dropdown,
  Menu,
  Switch,
  Segmented,
  message,
} from 'ant-design-vue'
import {
  UploadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  DownOutlined,
  CompressOutlined,
  FullscreenOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue'
import {
  usePhotoEditorStore,
  ASPECT_RATIO_VALUES,
  type CropAspectRatio,
} from '@/stores/photoEditorStore'
import { processImageFile } from '@/utils/imageProcessing'
import {
  FILTER_LABELS,
  DEFAULT_CURVES,
  type FilterName,
  type CropDragType,
  type Point2D,
} from '@/types/editor'
import type { ExportFormat } from '@/utils/splitterExport'
import { downloadImage } from '@/utils/downloadImage'
import { MIN_SPLIT_COUNT, MAX_SPLIT_COUNT } from '@/types/splitter'
import { useDragHandlerCumulative } from '@/composables/useDragHandler'
import { generateLUT, isCurveModified } from '@/utils/curveUtils'
import {
  applyCanvasFilter,
  applyCurvesToCanvas,
  applyPosterizeEffect,
  applyGrainEffect,
  applyVignetteEffect,
  buildCssFilterString,
} from '@/utils/canvasUtils'
import CurveEditor from './CurveEditor.vue'

const props = defineProps<{
  exportFormat: ExportFormat
}>()

const editorStore = usePhotoEditorStore()

const isExporting = ref(false)
const isProcessing = ref(false)
const isFullscreen = ref(false)
const containerRef = ref<HTMLDivElement | null>(null)

// Split photo state
const splitEnabled = ref(false)
const splitCount = ref(3)

// Position drag state
const positionStart = ref({ x: 0, y: 0 })

// Crop drag state
const isDraggingCrop = ref(false)
const dragType = ref<CropDragType | null>(null)
const dragStart = ref<Point2D>({ x: 0, y: 0 })
const cropStart = ref({ x: 0, y: 0, width: 100, height: 100 })

// Image bounds within container (accounting for object-fit: contain)
const imageBounds = ref({ x: 0, y: 0, width: 100, height: 100 })

// Aspect ratio options for dropdown
const aspectRatioOptions: { key: CropAspectRatio; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: '1:1', label: '1:1' },
  { key: '16:9', label: '16:9' },
  { key: '9:16', label: '9:16' },
  { key: '4:3', label: '4:3' },
  { key: '3:4', label: '3:4' },
  { key: '3:2', label: '3:2' },
  { key: '2:3', label: '2:3' },
]

// Current locked aspect ratio value (null if free)
const lockedRatio = computed(() => ASPECT_RATIO_VALUES[editorStore.cropAspectRatio])

// Split photo options
const splitCountOptions = computed(() => {
  const options = []
  for (let i = MIN_SPLIT_COUNT; i <= MAX_SPLIT_COUNT; i++) {
    options.push({ value: i, label: String(i) })
  }
  return options
})

// Generate split line positions for preview
const splitLines = computed(() => {
  if (!splitEnabled.value) return []
  const lines = []
  for (let i = 1; i < splitCount.value; i++) {
    lines.push((i / splitCount.value) * 100)
  }
  return lines
})

// Update image bounds based on current container and image dimensions
function updateImageBounds() {
  if (!containerRef.value || !editorStore.imageDimensions) {
    imageBounds.value = { x: 0, y: 0, width: 100, height: 100 }
    return
  }

  const rect = containerRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  // Account for padding
  const style = getComputedStyle(containerRef.value)
  const paddingLeft = parseFloat(style.paddingLeft) || 0
  const paddingRight = parseFloat(style.paddingRight) || 0
  const paddingTop = parseFloat(style.paddingTop) || 0
  const paddingBottom = parseFloat(style.paddingBottom) || 0

  const contentWidth = rect.width - paddingLeft - paddingRight
  const contentHeight = rect.height - paddingTop - paddingBottom

  // Calculate image layout within content area (in PIXELS)
  const imgWidth = editorStore.imageDimensions.width
  const imgHeight = editorStore.imageDimensions.height
  const contentRatio = contentWidth / contentHeight
  const imageRatio = imgWidth / imgHeight

  let displayWidth: number, displayHeight: number, imgOffsetX: number, imgOffsetY: number

  if (imageRatio > contentRatio) {
    displayWidth = contentWidth
    displayHeight = contentWidth / imageRatio
    imgOffsetX = 0
    imgOffsetY = (contentHeight - displayHeight) / 2
  } else {
    displayHeight = contentHeight
    displayWidth = contentHeight * imageRatio
    imgOffsetX = (contentWidth - displayWidth) / 2
    imgOffsetY = 0
  }

  // Position in container coordinates (PIXELS, including padding offset)
  let x_px = paddingLeft + imgOffsetX
  let y_px = paddingTop + imgOffsetY
  let width_px = displayWidth
  let height_px = displayHeight

  // Handle rotation - ALL MATH IN PIXELS
  const isRotated90or270 = editorStore.rotation === 90 || editorStore.rotation === 270

  if (isRotated90or270) {
    // Find center of layout box (in pixels)
    const centerX_px = x_px + width_px / 2
    const centerY_px = y_px + height_px / 2

    // Swap dimensions (in pixels)
    const visualWidth_px = height_px
    const visualHeight_px = width_px

    // New position centered at same point (in pixels)
    x_px = centerX_px - visualWidth_px / 2
    y_px = centerY_px - visualHeight_px / 2
    width_px = visualWidth_px
    height_px = visualHeight_px
  }

  // Convert to percentages ONLY at the end
  imageBounds.value = {
    x: (x_px / rect.width) * 100,
    y: (y_px / rect.height) * 100,
    width: (width_px / rect.width) * 100,
    height: (height_px / rect.height) * 100,
  }
}

// Initialize crop area to match image bounds when image loads
function initializeCropToImageBounds() {
  updateImageBounds()
  editorStore.setCropArea({ ...imageBounds.value })
}

// Reset crop to image bounds (called by reset button)
function resetCropToImageBounds() {
  updateImageBounds()
  editorStore.setCropArea({ ...imageBounds.value })
  editorStore.setCropAspectRatio('free')
}

// Reset all edits but keep crop at image bounds
function handleReset() {
  editorStore.resetEdits()
  // After resetting, set crop to image bounds
  setTimeout(() => resetCropToImageBounds(), 0)
}

// Handler for when image loads in the DOM - this is the reliable way to get bounds
function onImageLoad() {
  // Wait for next frame to ensure layout is finalized
  requestAnimationFrame(() => {
    initializeCropToImageBounds()
  })
}

// Constrain current crop to stay within image bounds (called on resize)
function constrainCropToImageBounds() {
  const bounds = imageBounds.value
  const crop = editorStore.cropArea

  // Clamp crop to stay within image bounds
  const newCrop = {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.width - crop.width, crop.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - crop.height, crop.y)),
    width: Math.min(bounds.width, crop.width),
    height: Math.min(bounds.height, crop.height),
  }

  editorStore.setCropArea(newCrop)
}

// ResizeObserver for handling container resize
let resizeObserver: ResizeObserver | null = null

// Handle escape key to close fullscreen
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('keydown', handleKeydown)
})

// Watch for container ref changes to setup ResizeObserver
watch(
  () => containerRef.value,
  (container) => {
    // Clean up old observer
    resizeObserver?.disconnect()

    if (container) {
      resizeObserver = new ResizeObserver(() => {
        if (editorStore.imageDimensions) {
          updateImageBounds()
          constrainCropToImageBounds()
        }
      })
      resizeObserver.observe(container)
    }
  },
  { immediate: true },
)

// Watch rotation changes to update bounds
watch(
  () => editorStore.rotation,
  () => {
    if (editorStore.hasImage) {
      updateImageBounds()
      constrainCropToImageBounds()
    }
  },
)

const imageTransformStyle = computed(() => ({
  transform: `rotate(${editorStore.rotation}deg) scale(${editorStore.zoom}) translate(${editorStore.position.x}%, ${editorStore.position.y}%)`,
}))

const cropAreaStyle = computed(() => ({
  left: `${editorStore.cropArea.x}%`,
  top: `${editorStore.cropArea.y}%`,
  width: `${editorStore.cropArea.width}%`,
  height: `${editorStore.cropArea.height}%`,
}))

// Check if any curves have been modified
const hasCurveChanges = computed(() => {
  return (
    isCurveModified(editorStore.curves.rgb, DEFAULT_CURVES.rgb) ||
    isCurveModified(editorStore.curves.red, DEFAULT_CURVES.red) ||
    isCurveModified(editorStore.curves.green, DEFAULT_CURVES.green) ||
    isCurveModified(editorStore.curves.blue, DEFAULT_CURVES.blue)
  )
})

// Generate LUT strings for SVG filter (space-separated values 0-1)
const redLUT = computed(() => {
  // Combine RGB curve with individual red curve
  const rgbLut = generateLUT(editorStore.curves.rgb)
  const redLut = generateLUT(editorStore.curves.red)
  return rgbLut.map((v) => redLut[Math.round(v * 255)] ?? v).join(' ')
})
const greenLUT = computed(() => {
  const rgbLut = generateLUT(editorStore.curves.rgb)
  const greenLut = generateLUT(editorStore.curves.green)
  return rgbLut.map((v) => greenLut[Math.round(v * 255)] ?? v).join(' ')
})
const blueLUT = computed(() => {
  const rgbLut = generateLUT(editorStore.curves.rgb)
  const blueLut = generateLUT(editorStore.curves.blue)
  return rgbLut.map((v) => blueLut[Math.round(v * 255)] ?? v).join(' ')
})

// Posterize LUT for SVG filter (discrete steps)
const posterizeLUT = computed(() => {
  if (editorStore.filters.posterize === 0) return '0 1'
  const levels = Math.max(2, Math.round(16 - (editorStore.filters.posterize / 100) * 14))
  const values: number[] = []
  for (let i = 0; i < levels; i++) {
    values.push(i / (levels - 1))
  }
  return values.join(' ')
})

// CSS filter for real-time preview (fast adjustments)
const cssFilterStyle = computed(() => {
  const filterParts: string[] = []

  // Apply SVG curve filter first if curves are modified
  if (hasCurveChanges.value) {
    filterParts.push('url(#curve-filter)')
  }

  // Build CSS filters for adjustments and filters (excluding grain/posterize/vignette which use SVG)
  const filtersForCss = { ...editorStore.filters, grain: 0, posterize: 0, vignette: 0 }
  const cssFilters = buildCssFilterString(editorStore.adjustments, filtersForCss)
  if (cssFilters) {
    filterParts.push(cssFilters)
  }

  // Sharpness - approximated via slight contrast boost (preview-specific)
  if (editorStore.adjustments.sharpness > 0) {
    filterParts.push(`contrast(${1 + editorStore.adjustments.sharpness / 500})`)
  }

  // SVG filters for effects that can't be done with CSS filters
  if (editorStore.filters.posterize > 0) {
    filterParts.push('url(#posterize-filter)')
  }
  if (editorStore.filters.grain > 0) {
    filterParts.push('url(#grain-filter)')
  }

  return filterParts.length > 0 ? filterParts.join(' ') : 'none'
})

// Vignette overlay style
const vignetteStyle = computed(() => {
  if (editorStore.filters.vignette === 0) return null
  const intensity = editorStore.filters.vignette / 100
  return {
    background: `radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(0,0,0,${intensity * 0.7}) 100%)`,
  }
})

const adjustmentSliders = [
  { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'brilliance', label: 'Brilliance', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
] as const

const allFilters = Object.keys(FILTER_LABELS) as FilterName[]

async function beforeUpload(file: File) {
  isProcessing.value = true
  try {
    const { file: processedFile, url } = await processImageFile(file)

    // Load image to get dimensions
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })

    editorStore.setImage(processedFile, url, {
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
  } catch {
    // Error already shown
  } finally {
    isProcessing.value = false
  }
  return false
}

function handleAspectRatioChange(info: { key: string | number }) {
  const ratio = String(info.key) as CropAspectRatio
  editorStore.setCropAspectRatio(ratio)

  // If not free, adjust crop area to match the new ratio
  if (ratio !== 'free') {
    const targetRatio = ASPECT_RATIO_VALUES[ratio]!
    const currentCrop = editorStore.cropArea
    const bounds = imageBounds.value
    const minX = bounds.x
    const minY = bounds.y
    const maxX = bounds.x + bounds.width
    const maxY = bounds.y + bounds.height

    // Calculate new dimensions while keeping center
    const centerX = currentCrop.x + currentCrop.width / 2
    const centerY = currentCrop.y + currentCrop.height / 2

    let newWidth = currentCrop.width
    let newHeight = currentCrop.height

    // Adjust to match target ratio (width/height)
    const currentRatio = currentCrop.width / currentCrop.height
    if (currentRatio > targetRatio) {
      // Too wide, reduce width
      newWidth = currentCrop.height * targetRatio
    } else {
      // Too tall, reduce height
      newHeight = currentCrop.width / targetRatio
    }

    // Center the new crop
    let newX = centerX - newWidth / 2
    let newY = centerY - newHeight / 2

    // Clamp to image bounds
    newX = Math.max(minX, Math.min(maxX - newWidth, newX))
    newY = Math.max(minY, Math.min(maxY - newHeight, newY))

    editorStore.setCropArea({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    })
  }
}

function handleZoomChange(value: number | [number, number]) {
  if (typeof value === 'number') {
    editorStore.setZoom(value)
  }
}

function handleAdjustmentChange(
  key: keyof typeof editorStore.adjustments,
  value: number | [number, number],
) {
  if (typeof value === 'number') {
    editorStore.setAdjustment(key, value)
  }
}

function handleFilterChange(key: FilterName, value: number | [number, number]) {
  if (typeof value === 'number') {
    editorStore.setFilter(key, value)
  }
}

function toggleFilter(filterName: FilterName) {
  const current = editorStore.filters[filterName]
  if (current > 0) {
    editorStore.setFilter(filterName, 0)
  } else {
    editorStore.setFilter(filterName, 50)
  }
}

function handleSplitEnabledChange(checked: boolean | string | number) {
  splitEnabled.value = Boolean(checked)
}

function handleSplitCountChange(value: string | number) {
  if (typeof value === 'number') {
    splitCount.value = value
  }
}

// Crop drag helper types and constants
interface CropBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

const MIN_CROP_SIZE = 10

// Helper: Clamp crop area to bounds
function clampCropToBounds(crop: CropArea, bounds: CropBounds): CropArea {
  return {
    ...crop,
    x: Math.max(bounds.minX, Math.min(bounds.maxX - crop.width, crop.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY - crop.height, crop.y)),
  }
}

// Helper: Handle free mode crop drag for edge handles
function handleCropDragFreeEdge(
  type: CropDragType,
  delta: Point2D,
  start: CropArea,
  bounds: CropBounds,
): CropArea {
  const crop = { ...start }

  switch (type) {
    case 'n':
      crop.y = Math.max(
        bounds.minY,
        Math.min(start.y + start.height - MIN_CROP_SIZE, start.y + delta.y),
      )
      crop.height = start.height - (crop.y - start.y)
      break
    case 's':
      crop.height = Math.max(MIN_CROP_SIZE, Math.min(bounds.maxY - start.y, start.height + delta.y))
      break
    case 'e':
      crop.width = Math.max(MIN_CROP_SIZE, Math.min(bounds.maxX - start.x, start.width + delta.x))
      break
    case 'w':
      crop.x = Math.max(
        bounds.minX,
        Math.min(start.x + start.width - MIN_CROP_SIZE, start.x + delta.x),
      )
      crop.width = start.width - (crop.x - start.x)
      break
    case 'ne':
      crop.y = Math.max(
        bounds.minY,
        Math.min(start.y + start.height - MIN_CROP_SIZE, start.y + delta.y),
      )
      crop.height = start.height - (crop.y - start.y)
      crop.width = Math.max(MIN_CROP_SIZE, Math.min(bounds.maxX - start.x, start.width + delta.x))
      break
    case 'nw':
      crop.y = Math.max(
        bounds.minY,
        Math.min(start.y + start.height - MIN_CROP_SIZE, start.y + delta.y),
      )
      crop.height = start.height - (crop.y - start.y)
      crop.x = Math.max(
        bounds.minX,
        Math.min(start.x + start.width - MIN_CROP_SIZE, start.x + delta.x),
      )
      crop.width = start.width - (crop.x - start.x)
      break
    case 'se':
      crop.height = Math.max(MIN_CROP_SIZE, Math.min(bounds.maxY - start.y, start.height + delta.y))
      crop.width = Math.max(MIN_CROP_SIZE, Math.min(bounds.maxX - start.x, start.width + delta.x))
      break
    case 'sw':
      crop.height = Math.max(MIN_CROP_SIZE, Math.min(bounds.maxY - start.y, start.height + delta.y))
      crop.x = Math.max(
        bounds.minX,
        Math.min(start.x + start.width - MIN_CROP_SIZE, start.x + delta.x),
      )
      crop.width = start.width - (crop.x - start.x)
      break
  }

  return crop
}

// Helper: Handle locked ratio crop drag for vertical edges (n, s)
function handleCropDragLockedVertical(
  type: 'n' | 's',
  delta: Point2D,
  start: CropArea,
  bounds: CropBounds,
  ratio: number,
): CropArea {
  const crop = { ...start }
  const heightChange = type === 'n' ? -delta.y : delta.y
  let newHeight = Math.max(MIN_CROP_SIZE, start.height + heightChange)
  let newWidth = newHeight * ratio

  // Clamp to bounds width and recalculate
  newWidth = Math.min(bounds.maxX - bounds.minX, newWidth)
  newHeight = newWidth / ratio

  crop.width = newWidth
  crop.height = newHeight

  // Adjust position
  if (type === 'n') {
    crop.y = start.y + start.height - newHeight
  }
  // Center horizontally
  crop.x = start.x + (start.width - newWidth) / 2

  return crop
}

// Helper: Handle locked ratio crop drag for horizontal edges (e, w)
function handleCropDragLockedHorizontal(
  type: 'e' | 'w',
  delta: Point2D,
  start: CropArea,
  bounds: CropBounds,
  ratio: number,
): CropArea {
  const crop = { ...start }
  const widthChange = type === 'w' ? -delta.x : delta.x
  let newWidth = Math.max(MIN_CROP_SIZE, start.width + widthChange)
  let newHeight = newWidth / ratio

  // Clamp to bounds height and recalculate
  newHeight = Math.min(bounds.maxY - bounds.minY, newHeight)
  newWidth = newHeight * ratio

  crop.width = newWidth
  crop.height = newHeight

  // Adjust position
  if (type === 'w') {
    crop.x = start.x + start.width - newWidth
  }
  // Center vertically
  crop.y = start.y + (start.height - newHeight) / 2

  return crop
}

// Helper: Handle locked ratio crop drag for corners
function handleCropDragLockedCorner(
  type: 'ne' | 'nw' | 'se' | 'sw',
  delta: Point2D,
  start: CropArea,
  bounds: CropBounds,
  ratio: number,
): CropArea {
  const crop = { ...start }
  const absDeltaX = Math.abs(delta.x)
  const absDeltaY = Math.abs(delta.y)

  // Use diagonal distance - pick the larger delta as driver
  const diagonalDelta = absDeltaX > absDeltaY ? delta.x : delta.y * ratio
  const sign = type === 'se' || type === 'ne' ? 1 : -1

  let newWidth = Math.max(MIN_CROP_SIZE, start.width + diagonalDelta * sign)
  let newHeight = newWidth / ratio

  // Calculate max dimensions based on anchor corner
  const maxWidth = type.includes('w') ? start.x + start.width - bounds.minX : bounds.maxX - start.x
  const maxHeight = type.includes('n')
    ? start.y + start.height - bounds.minY
    : bounds.maxY - start.y

  // Apply constraints
  if (newWidth > maxWidth) {
    newWidth = maxWidth
    newHeight = newWidth / ratio
  }
  if (newHeight > maxHeight) {
    newHeight = maxHeight
    newWidth = newHeight * ratio
  }

  crop.width = newWidth
  crop.height = newHeight

  // Adjust position based on anchor corner
  if (type.includes('w')) {
    crop.x = start.x + start.width - newWidth
  }
  if (type.includes('n')) {
    crop.y = start.y + start.height - newHeight
  }

  return crop
}

// Crop handle drag handlers
function startCropDrag(event: MouseEvent | TouchEvent, type: CropDragType) {
  event.preventDefault()
  event.stopPropagation()
  isDraggingCrop.value = true
  dragType.value = type

  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY

  dragStart.value = { x: clientX, y: clientY }
  cropStart.value = { ...editorStore.cropArea }

  document.addEventListener('mousemove', handleCropDrag)
  document.addEventListener('mouseup', stopCropDrag)
  document.addEventListener('touchmove', handleCropDrag, { passive: false })
  document.addEventListener('touchend', stopCropDrag)
}

function handleCropDrag(event: MouseEvent | TouchEvent) {
  if (!isDraggingCrop.value || !containerRef.value || !dragType.value) return
  event.preventDefault()

  const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
  const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY

  const rect = containerRef.value.getBoundingClientRect()
  const delta: Point2D = {
    x: ((clientX - dragStart.value.x) / rect.width) * 100,
    y: ((clientY - dragStart.value.y) / rect.height) * 100,
  }

  const ratio = lockedRatio.value
  const imgBounds = imageBounds.value
  const bounds: CropBounds = {
    minX: imgBounds.x,
    minY: imgBounds.y,
    maxX: imgBounds.x + imgBounds.width,
    maxY: imgBounds.y + imgBounds.height,
  }

  let newCrop: CropArea

  if (dragType.value === 'move') {
    // Move the entire crop area
    newCrop = {
      ...cropStart.value,
      x: cropStart.value.x + delta.x,
      y: cropStart.value.y + delta.y,
    }
    newCrop = clampCropToBounds(newCrop, bounds)
  } else if (ratio === null) {
    // Free mode
    newCrop = handleCropDragFreeEdge(dragType.value, delta, cropStart.value, bounds)
  } else {
    // Locked ratio mode
    const type = dragType.value
    if (type === 'n' || type === 's') {
      newCrop = handleCropDragLockedVertical(type, delta, cropStart.value, bounds, ratio)
    } else if (type === 'e' || type === 'w') {
      newCrop = handleCropDragLockedHorizontal(type, delta, cropStart.value, bounds, ratio)
    } else {
      newCrop = handleCropDragLockedCorner(type, delta, cropStart.value, bounds, ratio)
    }
    // Final bounds check for locked ratio
    newCrop = clampCropToBounds(newCrop, bounds)
  }

  editorStore.setCropArea(newCrop)
}

function stopCropDrag() {
  isDraggingCrop.value = false
  dragType.value = null
  document.removeEventListener('mousemove', handleCropDrag)
  document.removeEventListener('mouseup', stopCropDrag)
  document.removeEventListener('touchmove', handleCropDrag)
  document.removeEventListener('touchend', stopCropDrag)
}

// Position drag using composable
const { startDrag: startPositionDragBase } = useDragHandlerCumulative({
  onStart: () => {
    positionStart.value = { ...editorStore.position }
  },
  onMove: (delta) => {
    if (!containerRef.value) return

    const rect = containerRef.value.getBoundingClientRect()
    const deltaX = (delta.x / rect.width) * 50
    const deltaY = (delta.y / rect.height) * 50

    editorStore.setPosition(positionStart.value.x + deltaX, positionStart.value.y + deltaY)
  },
})

// Wrapper to prevent position drag when clicking crop handles
function startPositionDrag(event: MouseEvent | TouchEvent) {
  if ((event.target as HTMLElement).closest('.crop-handle')) return
  startPositionDragBase(event)
}

async function handleExport() {
  if (!editorStore.imageUrl) return

  isExporting.value = true
  try {
    // Load image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = editorStore.imageUrl!
    })

    // Create canvas with transformations
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // Calculate canvas dimensions based on rotation and crop
    const isRotated = editorStore.rotation === 90 || editorStore.rotation === 270
    const baseWidth = isRotated ? img.naturalHeight : img.naturalWidth
    const baseHeight = isRotated ? img.naturalWidth : img.naturalHeight

    // Convert container-relative cropArea to image-relative percentages
    const imgBounds = imageBounds.value
    const relCropX = Math.max(0, ((editorStore.cropArea.x - imgBounds.x) / imgBounds.width) * 100)
    const relCropY = Math.max(0, ((editorStore.cropArea.y - imgBounds.y) / imgBounds.height) * 100)
    const relCropW = Math.min(100, (editorStore.cropArea.width / imgBounds.width) * 100)
    const relCropH = Math.min(100, (editorStore.cropArea.height / imgBounds.height) * 100)

    const cropWidth = (relCropW / 100) * baseWidth * editorStore.zoom
    const cropHeight = (relCropH / 100) * baseHeight * editorStore.zoom

    canvas.width = cropWidth
    canvas.height = cropHeight

    // Scale factor for resolution-dependent effects
    const exportSize = Math.max(canvas.width, canvas.height)
    const scaleFactor = Math.max(1, exportSize / 600)

    // Step 1: Draw image with transforms
    ctx.save()
    const srcX = (relCropX / 100) * baseWidth * editorStore.zoom
    const srcY = (relCropY / 100) * baseHeight * editorStore.zoom
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((editorStore.rotation * Math.PI) / 180)
    ctx.scale(editorStore.zoom, editorStore.zoom)
    const drawX =
      -img.naturalWidth / 2 +
      (editorStore.position.x / 100) * img.naturalWidth -
      srcX / editorStore.zoom
    const drawY =
      -img.naturalHeight / 2 +
      (editorStore.position.y / 100) * img.naturalHeight -
      srcY / editorStore.zoom
    ctx.drawImage(img, drawX, drawY)
    ctx.restore()

    // Step 2: Apply CSS-compatible filters (without blur)
    const filtersWithoutBlur = { ...editorStore.filters, blur: 0 }
    const filterString = buildCssFilterString(editorStore.adjustments, filtersWithoutBlur)
    if (filterString) {
      applyCanvasFilter(canvas, ctx, filterString)
    }

    // Step 3: Apply blur separately (scaled for export resolution)
    if (editorStore.filters.blur > 0) {
      const scaledBlur = (editorStore.filters.blur / 10) * scaleFactor
      applyCanvasFilter(canvas, ctx, `blur(${scaledBlur}px)`)
    }

    // Step 4: Apply curves via pixel manipulation
    if (hasCurveChanges.value) {
      applyCurvesToCanvas(ctx, canvas.width, canvas.height, editorStore.curves)
    }

    // Step 5: Apply pixel-based effects
    applyPosterizeEffect(ctx, canvas.width, canvas.height, editorStore.filters.posterize)
    applyGrainEffect(ctx, canvas.width, canvas.height, editorStore.filters.grain, scaleFactor)
    applyVignetteEffect(ctx, canvas.width, canvas.height, editorStore.filters.vignette)

    // Step 6: Apply sharpness (simplified - contrast boost)
    if (editorStore.adjustments.sharpness > 0) {
      const intensity = editorStore.adjustments.sharpness / 100
      applyCanvasFilter(canvas, ctx, `contrast(${1 + intensity * 0.15})`)
    }

    // Step 7: Export (single or split)
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    const mimeType = props.exportFormat === 'png' ? 'image/png' : 'image/jpeg'
    const quality = props.exportFormat === 'jpg' ? 0.95 : 1

    if (splitEnabled.value && splitCount.value > 1) {
      // Split export
      const sliceWidth = canvas.width / splitCount.value
      for (let i = 0; i < splitCount.value; i++) {
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = sliceWidth
        sliceCanvas.height = canvas.height
        const sliceCtx = sliceCanvas.getContext('2d')!
        sliceCtx.drawImage(
          canvas,
          i * sliceWidth,
          0,
          sliceWidth,
          canvas.height,
          0,
          0,
          sliceWidth,
          canvas.height,
        )
        const sliceDataUrl = sliceCanvas.toDataURL(mimeType, quality)
        await downloadImage(
          sliceDataUrl,
          `photo-edit-${i + 1}-${timestamp}.${props.exportFormat}`,
          mimeType,
        )
        if (i < splitCount.value - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }
      message.success(`Exported ${splitCount.value} ${props.exportFormat.toUpperCase()} images`)
    } else {
      // Single image export
      const dataUrl = canvas.toDataURL(mimeType, quality)
      await downloadImage(dataUrl, `photo-edit-${timestamp}.${props.exportFormat}`, mimeType)
      message.success(`Exported as ${props.exportFormat.toUpperCase()}`)
    }
  } catch (error) {
    console.error('Export failed:', error)
    message.error('Failed to export image')
  } finally {
    isExporting.value = false
  }
}

// Expose export interface for parent component
defineExpose({
  handleExport,
  isExporting,
  canExport: computed(() => editorStore.hasImage),
  exportLabel: computed(() => {
    if (splitEnabled.value && splitCount.value > 1) {
      return `Export ${splitCount.value} ${props.exportFormat.toUpperCase()}s`
    }
    return `Export ${props.exportFormat.toUpperCase()}`
  }),
})
</script>

<template>
  <div class="photo-editor">
    <!-- SVG Filters for Curves, Grain, and Posterize -->
    <svg width="0" height="0" style="position: absolute; pointer-events: none">
      <defs>
        <filter id="curve-filter" color-interpolation-filters="sRGB">
          <feComponentTransfer>
            <feFuncR type="table" :tableValues="redLUT" />
            <feFuncG type="table" :tableValues="greenLUT" />
            <feFuncB type="table" :tableValues="blueLUT" />
          </feComponentTransfer>
        </filter>
        <!-- Grain filter using turbulence -->
        <filter id="grain-filter" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
          <feBlend in="SourceGraphic" in2="mono" mode="overlay" />
        </filter>
        <!-- Posterize filter using discrete transfer -->
        <filter id="posterize-filter" color-interpolation-filters="sRGB">
          <feComponentTransfer>
            <feFuncR type="discrete" :tableValues="posterizeLUT" />
            <feFuncG type="discrete" :tableValues="posterizeLUT" />
            <feFuncB type="discrete" :tableValues="posterizeLUT" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>

    <!-- Toolbar -->
    <Card class="toolbar-card">
      <Space wrap>
        <Upload
          :show-upload-list="false"
          :before-upload="beforeUpload"
          accept="image/*,.heic,.heif"
        >
          <Button :loading="isProcessing">
            <template #icon><UploadOutlined /></template>
            Upload
          </Button>
        </Upload>

        <Button :disabled="!editorStore.hasImage" @click="editorStore.rotateCounterClockwise">
          <template #icon><RotateLeftOutlined /></template>
        </Button>

        <Button :disabled="!editorStore.hasImage" @click="editorStore.rotateClockwise">
          <template #icon><RotateRightOutlined /></template>
        </Button>

        <div class="zoom-control">
          <ZoomInOutlined />
          <Slider
            :value="editorStore.zoom"
            :min="1"
            :max="3"
            :step="0.1"
            :disabled="!editorStore.hasImage"
            style="width: 100px"
            @change="handleZoomChange"
          />
          <span class="zoom-value">{{ editorStore.zoom.toFixed(1) }}x</span>
        </div>

        <Dropdown :trigger="['click']" :disabled="!editorStore.hasImage">
          <Button :disabled="!editorStore.hasImage">
            <template #icon><CompressOutlined /></template>
            {{ editorStore.cropAspectRatio === 'free' ? 'Free' : editorStore.cropAspectRatio }}
            <DownOutlined />
          </Button>
          <template #overlay>
            <Menu @click="handleAspectRatioChange">
              <Menu.Item
                v-for="option in aspectRatioOptions"
                :key="option.key"
                :class="{ 'menu-item-active': editorStore.cropAspectRatio === option.key }"
              >
                {{ option.label }}
              </Menu.Item>
            </Menu>
          </template>
        </Dropdown>

        <Button :disabled="!editorStore.hasImage" @click="handleReset">
          <template #icon><ReloadOutlined /></template>
          Reset
        </Button>

        <Button :disabled="!editorStore.hasImage" @click="isFullscreen = true">
          <template #icon><FullscreenOutlined /></template>
          Preview
        </Button>
      </Space>
    </Card>

    <div class="editor-body">
      <!-- Image Preview -->
      <Card class="preview-card">
        <div v-if="!editorStore.hasImage" class="upload-placeholder">
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
            :src="editorStore.imageUrl ?? undefined"
            :style="[imageTransformStyle, { filter: cssFilterStyle }]"
            class="editor-image"
            alt="Image to edit"
            @load="onImageLoad"
          />

          <!-- Vignette Overlay -->
          <div v-if="vignetteStyle" class="vignette-overlay" :style="vignetteStyle" />

          <!-- Crop Area Overlay -->
          <div class="crop-overlay">
            <div class="crop-area" :style="cropAreaStyle">
              <div
                class="crop-handle n"
                @mousedown="(e) => startCropDrag(e, 'n')"
                @touchstart="(e) => startCropDrag(e, 'n')"
              />
              <div
                class="crop-handle s"
                @mousedown="(e) => startCropDrag(e, 's')"
                @touchstart="(e) => startCropDrag(e, 's')"
              />
              <div
                class="crop-handle e"
                @mousedown="(e) => startCropDrag(e, 'e')"
                @touchstart="(e) => startCropDrag(e, 'e')"
              />
              <div
                class="crop-handle w"
                @mousedown="(e) => startCropDrag(e, 'w')"
                @touchstart="(e) => startCropDrag(e, 'w')"
              />
              <div
                class="crop-handle ne"
                @mousedown="(e) => startCropDrag(e, 'ne')"
                @touchstart="(e) => startCropDrag(e, 'ne')"
              />
              <div
                class="crop-handle nw"
                @mousedown="(e) => startCropDrag(e, 'nw')"
                @touchstart="(e) => startCropDrag(e, 'nw')"
              />
              <div
                class="crop-handle se"
                @mousedown="(e) => startCropDrag(e, 'se')"
                @touchstart="(e) => startCropDrag(e, 'se')"
              />
              <div
                class="crop-handle sw"
                @mousedown="(e) => startCropDrag(e, 'sw')"
                @touchstart="(e) => startCropDrag(e, 'sw')"
              />
              <div
                class="crop-move"
                @mousedown="(e) => startCropDrag(e, 'move')"
                @touchstart="(e) => startCropDrag(e, 'move')"
              />
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

      <!-- Controls Panel -->
      <Card class="controls-card">
        <Collapse :bordered="false" :default-active-key="['adjustments']">
          <!-- Adjustments -->
          <Collapse.Panel key="adjustments" header="Adjustments">
            <div class="slider-group">
              <div v-for="slider in adjustmentSliders" :key="slider.key" class="slider-row">
                <span class="slider-label">{{ slider.label }}</span>
                <Slider
                  :value="editorStore.adjustments[slider.key]"
                  :min="slider.min"
                  :max="slider.max"
                  :disabled="!editorStore.hasImage"
                  class="slider-control"
                  @change="(v: number | [number, number]) => handleAdjustmentChange(slider.key, v)"
                />
                <span class="slider-value">{{ editorStore.adjustments[slider.key] }}</span>
              </div>
            </div>
            <Button size="small" @click="editorStore.resetAdjustments">Reset Adjustments</Button>
          </Collapse.Panel>

          <!-- Curves -->
          <Collapse.Panel key="curves" header="Curves">
            <CurveEditor :disabled="!editorStore.hasImage" />
            <Button size="small" style="margin-top: 12px" @click="editorStore.resetCurves"
              >Reset Curves</Button
            >
          </Collapse.Panel>

          <!-- Filters -->
          <Collapse.Panel key="filters" header="Filters">
            <div class="filter-tags">
              <Tag
                v-for="filterName in allFilters"
                :key="filterName"
                :color="editorStore.filters[filterName] > 0 ? 'blue' : 'default'"
                class="filter-tag"
                @click="toggleFilter(filterName)"
              >
                {{ FILTER_LABELS[filterName] }}
              </Tag>
            </div>

            <div v-if="editorStore.activeFilters.length > 0" class="active-filters">
              <div
                v-for="filterName in editorStore.activeFilters"
                :key="filterName"
                class="slider-row"
              >
                <span class="slider-label">{{ FILTER_LABELS[filterName] }}</span>
                <Slider
                  :value="editorStore.filters[filterName]"
                  :min="0"
                  :max="100"
                  :disabled="!editorStore.hasImage"
                  class="slider-control"
                  @change="(v: number | [number, number]) => handleFilterChange(filterName, v)"
                />
                <span class="slider-value">{{ editorStore.filters[filterName] }}%</span>
              </div>
            </div>

            <Button size="small" style="margin-top: 12px" @click="editorStore.resetFilters"
              >Reset Filters</Button
            >
          </Collapse.Panel>

          <!-- Split Photo -->
          <Collapse.Panel key="split" header="Split Photo">
            <div class="split-control">
              <div class="split-row">
                <span class="split-label">Enable Split</span>
                <Switch :checked="splitEnabled" @change="handleSplitEnabledChange" />
              </div>
              <div class="split-row">
                <span class="split-label">Split into</span>
                <Segmented
                  :value="splitCount"
                  :options="splitCountOptions"
                  :disabled="!splitEnabled"
                  @change="handleSplitCountChange"
                />
                <span class="split-label">pieces</span>
              </div>
            </div>
          </Collapse.Panel>
        </Collapse>
      </Card>
    </div>

    <!-- Fullscreen Preview Overlay -->
    <Teleport to="body">
      <div v-if="isFullscreen" class="fullscreen-overlay" @click.self="isFullscreen = false">
        <button class="fullscreen-close" @click="isFullscreen = false">
          <CloseOutlined />
        </button>
        <div class="fullscreen-image-container">
          <img
            v-if="editorStore.imageUrl"
            :src="editorStore.imageUrl"
            :style="[imageTransformStyle, { filter: cssFilterStyle }]"
            class="fullscreen-image"
            alt="Fullscreen preview"
          />
          <div v-if="vignetteStyle" class="fullscreen-vignette" :style="vignetteStyle" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.photo-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.toolbar-card {
  max-width: 760px;
  margin: 0 auto;
}

.toolbar-card :deep(.ant-card-body) {
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

.editor-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 760px;
}

.preview-card :deep(.ant-card-body) {
  padding: 0;
  min-height: 400px;
}

.controls-card :deep(.ant-card-body) {
  padding: 0;
}

.controls-card :deep(.ant-collapse-header) {
  font-weight: 500;
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
  overflow: clip; /* Use clip instead of hidden to allow crop handles to be touchable at edges */
  aspect-ratio: 1 / 1;
  width: 100%;
  max-height: 75vh;
  background: #1a1a1a;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.image-container:active {
  cursor: grabbing;
}

.editor-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.vignette-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
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

.split-control {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.split-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.split-label {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-label {
  min-width: 80px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.slider-control {
  flex: 1;
}

.slider-value {
  min-width: 40px;
  text-align: right;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-tag {
  cursor: pointer;
  user-select: none;
}

.active-filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

@media (max-width: 767px) {
  .photo-editor {
    padding: 12px;
  }

  .toolbar-card :deep(.ant-card-body) {
    padding: 8px 12px;
  }

  .zoom-control {
    width: 100%;
    justify-content: center;
  }

  .crop-handle {
    width: 24px;
    height: 24px;
  }

  .crop-handle.n {
    top: -12px;
  }
  .crop-handle.s {
    bottom: -12px;
  }
  .crop-handle.e {
    right: -12px;
  }
  .crop-handle.w {
    left: -12px;
  }
  .crop-handle.ne {
    top: -12px;
    right: -12px;
  }
  .crop-handle.nw {
    top: -12px;
    left: -12px;
  }
  .crop-handle.se {
    bottom: -12px;
    right: -12px;
  }
  .crop-handle.sw {
    bottom: -12px;
    left: -12px;
  }
}
</style>

<style>
/* Fullscreen overlay - not scoped because it's teleported to body */
.fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  cursor: pointer;
}

.fullscreen-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 1001;
}

.fullscreen-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.fullscreen-image-container {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.fullscreen-image {
  max-width: 100%;
  max-height: calc(100vh - 80px);
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.fullscreen-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 4px;
}
</style>
