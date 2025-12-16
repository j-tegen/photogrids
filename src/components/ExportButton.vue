<script setup lang="ts">
import { ref } from 'vue'
import { Button, Dropdown, Menu, message } from 'ant-design-vue'
import { DownloadOutlined, DownOutlined } from '@ant-design/icons-vue'
import { toPng, toJpeg } from 'html-to-image'

const props = defineProps<{
  gridElement: HTMLElement | null
}>()

const isExporting = ref(false)

async function exportAs(format: 'png' | 'jpg') {
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

    if (format === 'png') {
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
    link.download = `photo-grid-${timestamp}.${format}`
    link.href = dataUrl
    link.click()

    message.success(`Grid exported as ${format.toUpperCase()}`)
  } catch (error) {
    console.error('Export failed:', error)
    message.error('Failed to export grid')
  } finally {
    isExporting.value = false
  }
}

function handleMenuClick(info: { key: string | number }) {
  exportAs(String(info.key) as 'png' | 'jpg')
}
</script>

<template>
  <Dropdown :trigger="['click']">
    <Button type="primary" size="large" :loading="isExporting">
      <template #icon><DownloadOutlined /></template>
      Export
      <DownOutlined />
    </Button>
    <template #overlay>
      <Menu @click="handleMenuClick">
        <Menu.Item key="png">Export as PNG</Menu.Item>
        <Menu.Item key="jpg">Export as JPG</Menu.Item>
      </Menu>
    </template>
  </Dropdown>
</template>
