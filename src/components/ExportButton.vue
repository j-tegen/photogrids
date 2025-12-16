<script setup lang="ts">
import { ref } from 'vue'
import { Button, message } from 'ant-design-vue'
import { DownloadOutlined } from '@ant-design/icons-vue'
import { toPng, toJpeg } from 'html-to-image'
import type { ExportFormat } from '@/utils/splitterExport'

const props = defineProps<{
  gridElement: HTMLElement | null
  format: ExportFormat
}>()

const isExporting = ref(false)

async function handleExport() {
  if (!props.gridElement) {
    message.error('Grid element not found')
    return
  }

  isExporting.value = true

  try {
    const gridElement = props.gridElement.querySelector('.photo-grid') as HTMLElement
    if (!gridElement) {
      throw new Error('Photo grid not found')
    }

    let dataUrl: string

    if (props.format === 'png') {
      dataUrl = await toPng(gridElement, {
        quality: 1,
        pixelRatio: 2,
      })
    } else {
      dataUrl = await toJpeg(gridElement, {
        quality: 0.95,
        pixelRatio: 2,
      })
    }

    // Create download link
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    link.download = `photo-grid-${timestamp}.${props.format}`
    link.href = dataUrl
    link.click()

    message.success(`Grid exported as ${props.format.toUpperCase()}`)
  } catch (error) {
    console.error('Export failed:', error)
    message.error('Failed to export grid')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <Button type="primary" size="large" :loading="isExporting" @click="handleExport">
    <template #icon><DownloadOutlined /></template>
    Export {{ format.toUpperCase() }}
  </Button>
</template>
