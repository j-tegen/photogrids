import type { CropArea, Rotation } from '@/types/splitter'

export type ExportFormat = 'png' | 'jpg'

interface ExportOptions {
  image: HTMLImageElement
  rotation: Rotation
  zoom: number
  position: { x: number; y: number }
  cropArea: CropArea
  splitCount: number
  format: ExportFormat
}

function createTransformedCanvas(
  image: HTMLImageElement,
  rotation: Rotation,
  zoom: number,
  position: { x: number; y: number },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Determine canvas size based on rotation
  const isRotated90or270 = rotation === 90 || rotation === 270
  const baseWidth = isRotated90or270 ? image.naturalHeight : image.naturalWidth
  const baseHeight = isRotated90or270 ? image.naturalWidth : image.naturalHeight

  canvas.width = baseWidth * zoom
  canvas.height = baseHeight * zoom

  ctx.save()

  // Move to center
  ctx.translate(canvas.width / 2, canvas.height / 2)

  // Apply rotation
  ctx.rotate((rotation * Math.PI) / 180)

  // Apply zoom
  ctx.scale(zoom, zoom)

  // Apply position offset (as percentage of image size)
  const offsetX = (position.x / 100) * image.naturalWidth
  const offsetY = (position.y / 100) * image.naturalHeight

  // Draw image centered
  ctx.drawImage(
    image,
    -image.naturalWidth / 2 + offsetX,
    -image.naturalHeight / 2 + offsetY,
  )

  ctx.restore()

  return canvas
}

function cropCanvas(
  sourceCanvas: HTMLCanvasElement,
  cropArea: CropArea,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Calculate crop dimensions in pixels
  const cropX = (cropArea.x / 100) * sourceCanvas.width
  const cropY = (cropArea.y / 100) * sourceCanvas.height
  const cropWidth = (cropArea.width / 100) * sourceCanvas.width
  const cropHeight = (cropArea.height / 100) * sourceCanvas.height

  canvas.width = cropWidth
  canvas.height = cropHeight

  ctx.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  )

  return canvas
}

function splitCanvas(
  sourceCanvas: HTMLCanvasElement,
  splitCount: number,
): HTMLCanvasElement[] {
  const slices: HTMLCanvasElement[] = []
  const sliceWidth = sourceCanvas.width / splitCount

  for (let i = 0; i < splitCount; i++) {
    const sliceCanvas = document.createElement('canvas')
    const ctx = sliceCanvas.getContext('2d')!

    sliceCanvas.width = sliceWidth
    sliceCanvas.height = sourceCanvas.height

    ctx.drawImage(
      sourceCanvas,
      i * sliceWidth,
      0,
      sliceWidth,
      sourceCanvas.height,
      0,
      0,
      sliceWidth,
      sourceCanvas.height,
    )

    slices.push(sliceCanvas)
  }

  return slices
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: ExportFormat): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = format === 'png'
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.95)
  link.click()
}

export async function exportSplits(options: ExportOptions): Promise<void> {
  const { image, rotation, zoom, position, cropArea, splitCount, format } = options

  // Step 1: Create transformed canvas (rotation, zoom, position)
  const transformedCanvas = createTransformedCanvas(image, rotation, zoom, position)

  // Step 2: Crop the canvas
  const croppedCanvas = cropCanvas(transformedCanvas, cropArea)

  // Step 3: Split into n pieces
  const slices = splitCanvas(croppedCanvas, splitCount)

  // Step 4: Download each slice with a small delay to prevent browser issues
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    if (slice) {
      downloadCanvas(slice, `split-${i + 1}-${timestamp}.${format}`, format)
      // Small delay between downloads
      if (i < slices.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }
  }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
