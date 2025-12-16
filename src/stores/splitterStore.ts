import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { CropArea, Position, Rotation } from '@/types/splitter'
import {
  DEFAULT_SPLIT_COUNT,
  DEFAULT_ZOOM,
  MIN_SPLIT_COUNT,
  MAX_SPLIT_COUNT,
  MIN_ZOOM,
  MAX_ZOOM,
} from '@/types/splitter'

const DEFAULT_CROP_AREA: CropArea = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
}

const DEFAULT_POSITION: Position = {
  x: 0,
  y: 0,
}

export const useSplitterStore = defineStore('splitter', () => {
  // State
  const imageFile = ref<File | null>(null)
  const imageUrl = ref<string | null>(null)
  const rotation = ref<Rotation>(0)
  const zoom = ref(DEFAULT_ZOOM)
  const position = ref<Position>({ ...DEFAULT_POSITION })
  const cropArea = ref<CropArea>({ ...DEFAULT_CROP_AREA })
  const splitCount = ref(DEFAULT_SPLIT_COUNT)

  // Computed
  const hasImage = computed(() => imageUrl.value !== null)

  const splitWidthPercent = computed(() => {
    return cropArea.value.width / splitCount.value
  })

  // Actions
  function setImage(file: File | null, url: string | null) {
    // Revoke old URL if exists
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
    }
    imageFile.value = file
    imageUrl.value = url
    // Reset transforms when new image is loaded
    rotation.value = 0
    zoom.value = DEFAULT_ZOOM
    position.value = { ...DEFAULT_POSITION }
    cropArea.value = { ...DEFAULT_CROP_AREA }
  }

  function setRotation(degrees: Rotation) {
    rotation.value = degrees
  }

  function rotateClockwise() {
    const newRotation = ((rotation.value + 90) % 360) as Rotation
    rotation.value = newRotation
  }

  function rotateCounterClockwise() {
    const newRotation = ((rotation.value - 90 + 360) % 360) as Rotation
    rotation.value = newRotation
  }

  function setZoom(level: number) {
    zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level))
  }

  function setPosition(x: number, y: number) {
    position.value = { x, y }
  }

  function setCropArea(area: Partial<CropArea>) {
    cropArea.value = {
      ...cropArea.value,
      ...area,
      x: Math.max(0, Math.min(100, area.x ?? cropArea.value.x)),
      y: Math.max(0, Math.min(100, area.y ?? cropArea.value.y)),
      width: Math.max(10, Math.min(100, area.width ?? cropArea.value.width)),
      height: Math.max(10, Math.min(100, area.height ?? cropArea.value.height)),
    }
  }

  function setSplitCount(count: number) {
    splitCount.value = Math.max(MIN_SPLIT_COUNT, Math.min(MAX_SPLIT_COUNT, count))
  }

  function reset() {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
    }
    imageFile.value = null
    imageUrl.value = null
    rotation.value = 0
    zoom.value = DEFAULT_ZOOM
    position.value = { ...DEFAULT_POSITION }
    cropArea.value = { ...DEFAULT_CROP_AREA }
    splitCount.value = DEFAULT_SPLIT_COUNT
  }

  return {
    // State
    imageFile,
    imageUrl,
    rotation,
    zoom,
    position,
    cropArea,
    splitCount,
    // Computed
    hasImage,
    splitWidthPercent,
    // Actions
    setImage,
    setRotation,
    rotateClockwise,
    rotateCounterClockwise,
    setZoom,
    setPosition,
    setCropArea,
    setSplitCount,
    reset,
  }
})
