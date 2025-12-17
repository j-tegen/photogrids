import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Rotation, CropArea } from '@/types/splitter'
import type {
  Adjustments,
  ColorCurves,
  FilterSettings,
  CurveChannel,
  CurvePoint,
  FilterName,
} from '@/types/editor'
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_FILTERS,
} from '@/types/editor'

export type CropAspectRatio = 'free' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3'

export const ASPECT_RATIO_VALUES: Record<CropAspectRatio, number | null> = {
  'free': null,
  '1:1': 1,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '3:2': 3 / 2,
  '2:3': 2 / 3,
}

export const usePhotoEditorStore = defineStore('photoEditor', () => {
  // Image state
  const imageFile = ref<File | null>(null)
  const imageUrl = ref<string | null>(null)
  const imageDimensions = ref<{ width: number; height: number } | null>(null)

  // Transform state
  const rotation = ref<Rotation>(0)
  const zoom = ref(1)
  const position = ref({ x: 0, y: 0 })
  const cropArea = ref<CropArea>({ x: 0, y: 0, width: 100, height: 100 })
  const cropAspectRatio = ref<CropAspectRatio>('free')

  // Adjustment state
  const adjustments = ref<Adjustments>({ ...DEFAULT_ADJUSTMENTS })

  // Curves state
  const curves = ref<ColorCurves>(JSON.parse(JSON.stringify(DEFAULT_CURVES)))
  const activeCurveChannel = ref<CurveChannel>('rgb')

  // Filter state
  const filters = ref<FilterSettings>({ ...DEFAULT_FILTERS })

  // Computed
  const hasImage = computed(() => imageUrl.value !== null)

  const activeFilters = computed(() => {
    const active: FilterName[] = []
    for (const [key, value] of Object.entries(filters.value)) {
      if (value > 0) {
        active.push(key as FilterName)
      }
    }
    return active
  })

  const hasAnyEdits = computed(() => {
    // Check adjustments
    for (const key of Object.keys(adjustments.value) as (keyof Adjustments)[]) {
      if (adjustments.value[key] !== DEFAULT_ADJUSTMENTS[key]) {
        return true
      }
    }

    // Check filters
    for (const key of Object.keys(filters.value) as (keyof FilterSettings)[]) {
      if (filters.value[key] !== DEFAULT_FILTERS[key]) {
        return true
      }
    }

    // Check curves (compare point counts and positions)
    for (const channel of ['rgb', 'red', 'green', 'blue'] as CurveChannel[]) {
      const channelCurve = curves.value[channel]
      const defaultCurve = DEFAULT_CURVES[channel]
      if (channelCurve.length !== defaultCurve.length) {
        return true
      }
      for (let i = 0; i < channelCurve.length; i++) {
        const cp = channelCurve[i]
        const dp = defaultCurve[i]
        if (!cp || !dp) return true
        if (cp.x !== dp.x || cp.y !== dp.y) {
          return true
        }
      }
    }

    // Check transforms
    if (rotation.value !== 0 || zoom.value !== 1) {
      return true
    }
    if (position.value.x !== 0 || position.value.y !== 0) {
      return true
    }
    if (
      cropArea.value.x !== 0 ||
      cropArea.value.y !== 0 ||
      cropArea.value.width !== 100 ||
      cropArea.value.height !== 100
    ) {
      return true
    }

    return false
  })

  // Actions
  function setImage(file: File, url: string, dimensions?: { width: number; height: number }) {
    imageFile.value = file
    imageUrl.value = url
    imageDimensions.value = dimensions ?? null
    resetEdits()
  }

  function setImageDimensions(width: number, height: number) {
    imageDimensions.value = { width, height }
  }

  function clearImage() {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
    }
    imageFile.value = null
    imageUrl.value = null
    imageDimensions.value = null
    resetEdits()
  }

  function setRotation(value: Rotation) {
    rotation.value = value
  }

  function rotateClockwise() {
    rotation.value = ((rotation.value + 90) % 360) as Rotation
  }

  function rotateCounterClockwise() {
    rotation.value = ((rotation.value - 90 + 360) % 360) as Rotation
  }

  function setZoom(value: number) {
    zoom.value = Math.max(1, Math.min(3, value))
  }

  function setPosition(x: number, y: number) {
    position.value = { x, y }
  }

  function setCropArea(area: CropArea) {
    cropArea.value = area
  }

  function setCropAspectRatio(ratio: CropAspectRatio) {
    cropAspectRatio.value = ratio
  }

  function setAdjustment(key: keyof Adjustments, value: number) {
    adjustments.value[key] = value
  }

  function setFilter(key: FilterName, value: number) {
    filters.value[key] = value
  }

  function setCurveChannel(channel: CurveChannel) {
    activeCurveChannel.value = channel
  }

  function setCurvePoints(channel: CurveChannel, points: CurvePoint[]) {
    curves.value[channel] = points
  }

  function addCurvePoint(channel: CurveChannel, point: CurvePoint) {
    const channelCurve = curves.value[channel]
    // Insert in sorted order by x
    const insertIndex = channelCurve.findIndex((p) => p.x > point.x)
    if (insertIndex === -1) {
      channelCurve.push(point)
    } else {
      channelCurve.splice(insertIndex, 0, point)
    }
  }

  function removeCurvePoint(channel: CurveChannel, index: number) {
    // Don't remove first or last point
    if (index === 0 || index === curves.value[channel].length - 1) {
      return
    }
    curves.value[channel].splice(index, 1)
  }

  function updateCurvePoint(channel: CurveChannel, index: number, point: CurvePoint) {
    // Clamp values
    point.x = Math.max(0, Math.min(255, point.x))
    point.y = Math.max(0, Math.min(255, point.y))

    // Don't allow moving first point's x or last point's x
    const channelCurve = curves.value[channel]
    if (index === 0) {
      point.x = 0
    } else if (index === channelCurve.length - 1) {
      point.x = 255
    }

    channelCurve[index] = point
  }

  function resetAdjustments() {
    adjustments.value = { ...DEFAULT_ADJUSTMENTS }
  }

  function resetFilters() {
    filters.value = { ...DEFAULT_FILTERS }
  }

  function resetCurves() {
    curves.value = JSON.parse(JSON.stringify(DEFAULT_CURVES))
  }

  function resetTransforms() {
    rotation.value = 0
    zoom.value = 1
    position.value = { x: 0, y: 0 }
    cropArea.value = { x: 0, y: 0, width: 100, height: 100 }
    cropAspectRatio.value = 'free'
  }

  function resetEdits() {
    resetAdjustments()
    resetFilters()
    resetCurves()
    resetTransforms()
  }

  function resetAll() {
    clearImage()
  }

  return {
    // State
    imageFile,
    imageUrl,
    imageDimensions,
    rotation,
    zoom,
    position,
    cropArea,
    cropAspectRatio,
    adjustments,
    curves,
    activeCurveChannel,
    filters,

    // Computed
    hasImage,
    activeFilters,
    hasAnyEdits,

    // Actions
    setImage,
    setImageDimensions,
    clearImage,
    setRotation,
    rotateClockwise,
    rotateCounterClockwise,
    setZoom,
    setPosition,
    setCropArea,
    setCropAspectRatio,
    setAdjustment,
    setFilter,
    setCurveChannel,
    setCurvePoints,
    addCurvePoint,
    removeCurvePoint,
    updateCurvePoint,
    resetAdjustments,
    resetFilters,
    resetCurves,
    resetTransforms,
    resetEdits,
    resetAll,
  }
})
