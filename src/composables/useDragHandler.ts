import { ref, onUnmounted } from 'vue'
import type { Point2D } from '@/types/editor'

export interface DragEvent {
  clientX: number
  clientY: number
  originalEvent: MouseEvent | TouchEvent
}

export interface DragCallbacks {
  onStart?: (event: DragEvent) => void
  onMove: (delta: Point2D, event: DragEvent) => void
  onEnd?: () => void
}

/**
 * Extracts client coordinates from mouse or touch events
 */
function getClientCoords(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ('touches' in event) {
    const touch = event.touches[0]
    if (!touch) return null
    return { x: touch.clientX, y: touch.clientY }
  }
  return { x: event.clientX, y: event.clientY }
}

/**
 * A composable for handling drag interactions with mouse and touch support.
 * Uses incremental deltas (delta from last position, not from start).
 * Manages document-level event listeners with proper cleanup.
 *
 * @param callbacks - Object containing onStart, onMove, and onEnd callbacks
 * @returns Object with startDrag function, isDragging ref, and lastPosition ref
 *
 * @example
 * ```ts
 * const { startDrag, isDragging } = useDragHandler({
 *   onMove: (delta) => {
 *     // delta is from last position (incremental)
 *     position.x += delta.x
 *   }
 * })
 * ```
 */
export function useDragHandler(callbacks: DragCallbacks) {
  const isDragging = ref(false)
  const lastPosition = ref<Point2D>({ x: 0, y: 0 })

  function handleMove(event: MouseEvent | TouchEvent) {
    if (!isDragging.value) return
    event.preventDefault()

    const coords = getClientCoords(event)
    if (!coords) return

    // Incremental delta from last position
    const delta: Point2D = {
      x: coords.x - lastPosition.value.x,
      y: coords.y - lastPosition.value.y,
    }

    // Update last position for next increment
    lastPosition.value = { x: coords.x, y: coords.y }

    callbacks.onMove(delta, {
      clientX: coords.x,
      clientY: coords.y,
      originalEvent: event,
    })
  }

  function handleEnd() {
    if (!isDragging.value) return

    isDragging.value = false
    callbacks.onEnd?.()

    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleEnd)
    document.removeEventListener('touchmove', handleMove)
    document.removeEventListener('touchend', handleEnd)
  }

  function startDrag(event: MouseEvent | TouchEvent) {
    // For touch events, only handle single touch
    if ('touches' in event && event.touches.length !== 1) return

    event.preventDefault()

    const coords = getClientCoords(event)
    if (!coords) return

    isDragging.value = true
    lastPosition.value = { x: coords.x, y: coords.y }

    const dragEvent: DragEvent = {
      clientX: coords.x,
      clientY: coords.y,
      originalEvent: event,
    }

    callbacks.onStart?.(dragEvent)

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
  }

  // Cleanup on unmount to prevent memory leaks
  onUnmounted(() => {
    if (isDragging.value) {
      handleEnd()
    }
  })

  return {
    startDrag,
    isDragging,
    lastPosition,
  }
}

/**
 * A variant that tracks cumulative delta from the start position.
 * Useful when you want to track total drag distance rather than incremental moves.
 *
 * @param callbacks - Object containing onStart, onMove, and onEnd callbacks
 * @returns Object with startDrag function, isDragging ref, and updateStartPosition function
 */
export function useDragHandlerCumulative(callbacks: DragCallbacks) {
  const isDragging = ref(false)
  const dragStartPosition = ref<Point2D>({ x: 0, y: 0 })

  function handleMove(event: MouseEvent | TouchEvent) {
    if (!isDragging.value) return
    event.preventDefault()

    const coords = getClientCoords(event)
    if (!coords) return

    // Cumulative delta from the original start position
    const delta: Point2D = {
      x: coords.x - dragStartPosition.value.x,
      y: coords.y - dragStartPosition.value.y,
    }

    callbacks.onMove(delta, {
      clientX: coords.x,
      clientY: coords.y,
      originalEvent: event,
    })
  }

  function handleEnd() {
    if (!isDragging.value) return

    isDragging.value = false
    callbacks.onEnd?.()

    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleEnd)
    document.removeEventListener('touchmove', handleMove)
    document.removeEventListener('touchend', handleEnd)
  }

  function startDrag(event: MouseEvent | TouchEvent) {
    if ('touches' in event && event.touches.length !== 1) return

    event.preventDefault()

    const coords = getClientCoords(event)
    if (!coords) return

    isDragging.value = true
    dragStartPosition.value = { x: coords.x, y: coords.y }

    const dragEvent: DragEvent = {
      clientX: coords.x,
      clientY: coords.y,
      originalEvent: event,
    }

    callbacks.onStart?.(dragEvent)

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
  }

  onUnmounted(() => {
    if (isDragging.value) {
      handleEnd()
    }
  })

  return {
    startDrag,
    isDragging,
    dragStartPosition,
  }
}
