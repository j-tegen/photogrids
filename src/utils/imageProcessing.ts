import { isHeic, heicTo } from 'heic-to'
import { message } from 'ant-design-vue'

export async function processImageFile(file: File): Promise<{ file: File; url: string }> {
  try {
    // Check if file is HEIC using heic-to's built-in detection
    const isHeicFile = await isHeic(file)

    if (isHeicFile) {
      const blob = await heicTo({
        blob: file,
        type: 'image/jpeg',
        quality: 0.9,
      })

      const convertedFile = new File(
        [blob],
        file.name.replace(/\.(heic|heif)$/i, '.jpg'),
        { type: 'image/jpeg' },
      )

      return {
        file: convertedFile,
        url: URL.createObjectURL(blob),
      }
    }

    return {
      file,
      url: URL.createObjectURL(file),
    }
  } catch (error) {
    console.error('Image processing failed:', error)
    message.error('Could not process image file. Please try a different photo.')
    throw error
  }
}
