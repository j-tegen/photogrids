<script setup lang="ts">
import { ref, computed } from 'vue'
import { Layout, Card, Button, Dropdown, Menu, message } from 'ant-design-vue'
import { ReloadOutlined, AppstoreOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { toPng, toJpeg } from 'html-to-image'
import { downloadImage } from './utils/downloadImage'
import GridControls from './components/GridControls.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import PhotoEditor from './components/PhotoEditor.vue'
import { useGridStore } from './stores/gridStore'
import type { ExportFormat } from './utils/splitterExport'

const gridStore = useGridStore()
const photoGridRef = ref<InstanceType<typeof PhotoGrid> | null>(null)
const photoEditorRef = ref<InstanceType<typeof PhotoEditor> | null>(null)

const activeTab = ref('grid')
const exportFormat = ref<ExportFormat>('png')
const exportingGrid = ref(false)

// Unified export state
const canExport = computed(() => {
  if (activeTab.value === 'grid') return photoGridRef.value?.gridRef != null
  if (activeTab.value === 'editor') return photoEditorRef.value?.canExport
  return false
})

const isExporting = computed(() => {
  if (activeTab.value === 'grid') return exportingGrid.value
  if (activeTab.value === 'editor') return photoEditorRef.value?.isExporting
  return false
})

const exportButtonText = computed(() => {
  if (activeTab.value === 'grid') return `Export ${exportFormat.value.toUpperCase()}`
  if (activeTab.value === 'editor') return photoEditorRef.value?.exportLabel ?? 'Export'
  return 'Export'
})

// Grid export logic (moved from ExportButton.vue)
async function exportGrid() {
  const gridElement = photoGridRef.value?.gridRef
  if (!gridElement) {
    message.error('Grid element not found')
    return
  }

  exportingGrid.value = true
  try {
    const photoGrid = gridElement.querySelector('.photo-grid') as HTMLElement
    if (!photoGrid) {
      throw new Error('Photo grid not found')
    }

    let dataUrl: string
    if (exportFormat.value === 'png') {
      dataUrl = await toPng(photoGrid, { quality: 1, pixelRatio: 2 })
    } else {
      dataUrl = await toJpeg(photoGrid, { quality: 0.95, pixelRatio: 2 })
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    const mimeType = exportFormat.value === 'png' ? 'image/png' : 'image/jpeg'
    await downloadImage(dataUrl, `photo-grid-${timestamp}.${exportFormat.value}`, mimeType)

    message.success(`Grid exported as ${exportFormat.value.toUpperCase()}`)
  } catch (error) {
    console.error('Export failed:', error)
    message.error('Failed to export grid')
  } finally {
    exportingGrid.value = false
  }
}

// Unified export handler
async function handleExport() {
  if (activeTab.value === 'grid') {
    await exportGrid()
  } else if (activeTab.value === 'editor') {
    await photoEditorRef.value?.handleExport()
  }
}

function handleFormatChange(info: { key: string | number }) {
  exportFormat.value = String(info.key) as ExportFormat
}
</script>

<template>
  <Layout class="app-layout">
    <Layout.Header class="app-header">
      <h1>Photo Tools</h1>
      <div class="header-tabs">
        <button
          :class="['header-tab', { active: activeTab === 'grid' }]"
          @click="activeTab = 'grid'"
        >
          <AppstoreOutlined />
          Grid View
        </button>
        <button
          :class="['header-tab', { active: activeTab === 'editor' }]"
          @click="activeTab = 'editor'"
        >
          <EditOutlined />
          Photo Editor
        </button>
      </div>
      <Dropdown.Button
        type="primary"
        :disabled="!canExport"
        :loading="isExporting"
        @click="handleExport"
      >
        <template #overlay>
          <Menu @click="handleFormatChange">
            <Menu.Item key="png" :class="{ 'menu-item-active': exportFormat === 'png' }">
              Export as PNG
            </Menu.Item>
            <Menu.Item key="jpg" :class="{ 'menu-item-active': exportFormat === 'jpg' }">
              Export as JPG
            </Menu.Item>
          </Menu>
        </template>
        <DownloadOutlined />
        {{ exportButtonText }}
      </Dropdown.Button>
    </Layout.Header>

    <Layout class="app-body">
      <Layout.Content class="app-content">
        <!-- Grid View -->
        <div v-if="activeTab === 'grid'" class="tab-content">
          <Card class="grid-card">
            <PhotoGrid ref="photoGridRef" />
          </Card>
          <Card class="grid-controls-card">
            <GridControls />
            <div class="controls-footer">
              <Button block @click="gridStore.resetGrid">
                <template #icon><ReloadOutlined /></template>
                Reset Grid
              </Button>
            </div>
          </Card>
        </div>

        <!-- Photo Editor -->
        <div v-if="activeTab === 'editor'" class="tab-content">
          <PhotoEditor ref="photoEditorRef" :export-format="exportFormat" />
        </div>
      </Layout.Content>
    </Layout>
  </Layout>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}

.app-header {
  background: #001529;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 12px;
}

.app-header h1 {
  color: #fff;
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.header-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: center;
}

.header-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.header-tab:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.header-tab.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

.app-body {
  flex: 1;
}

.app-content {
  padding: 0;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.tab-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.grid-card {
  width: 100%;
  max-width: 760px;
}

.grid-card :deep(.ant-card-body) {
  padding: 24px;
}

.grid-controls-card {
  width: 100%;
  max-width: 760px;
}

.controls-footer {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
  margin-top: 16px;
}

@media (max-width: 767px) {
  .app-header {
    padding: 0 16px;
  }

  .app-header h1 {
    display: none;
  }

  .tab-content {
    padding: 16px;
  }

  .grid-card :deep(.ant-card-body) {
    padding: 12px;
  }
}
</style>

<style>
body {
  margin: 0;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    sans-serif;
}

.menu-item-active {
  background-color: #e6f4ff;
  font-weight: 500;
}

/* Disabled export button styling for dark header */
.app-header .ant-dropdown-button > .ant-btn:disabled,
.app-header .ant-dropdown-button > .ant-btn-group > .ant-btn:disabled {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.4);
}
</style>
