/**
 * Check if running on a mobile device (iOS/Android)
 * macOS also supports Web Share API but we want direct download there
 */
function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Download or share an image, with iOS support via Web Share API
 */
export async function downloadImage(
  dataUrl: string,
  filename: string,
  mimeType: 'image/png' | 'image/jpeg'
): Promise<void> {
  // Convert data URL to blob
  const response = await fetch(dataUrl)
  const blob = await response.blob()

  // Use Web Share API only on mobile devices (iOS/Android)
  // macOS also supports canShare but we want direct download there
  if (isMobileDevice() && navigator.canShare) {
    const file = new File([blob], filename, { type: mimeType })
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
      })
      return
    }
  }

  // Traditional download (desktop browsers)
  const link = document.createElement('a')
  link.download = filename
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}
