<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Layout, Card, Button, Drawer, Tabs, Dropdown, Menu } from 'ant-design-vue'
import { ReloadOutlined, MenuOutlined, AppstoreOutlined, ScissorOutlined, DownOutlined } from '@ant-design/icons-vue'
import GridControls from './components/GridControls.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import ExportButton from './components/ExportButton.vue'
import PhotoSplitter from './components/PhotoSplitter.vue'
import { useGridStore } from './stores/gridStore'
import type { ExportFormat } from './utils/splitterExport'

const gridStore = useGridStore()
const photoGridRef = ref<InstanceType<typeof PhotoGrid> | null>(null)

const MOBILE_BREAKPOINT = 768
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)
const drawerVisible = ref(false)
const activeTab = ref('grid')
const exportFormat = ref<ExportFormat>('png')

const showSidebar = computed(() => activeTab.value === 'grid')

function handleResize() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
  if (!isMobile.value) {
    drawerVisible.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <Layout class="app-layout">
    <Layout.Header class="app-header">
      <Button
        v-if="isMobile && showSidebar"
        type="text"
        class="menu-btn"
        @click="drawerVisible = true"
      >
        <template #icon><MenuOutlined /></template>
      </Button>
      <h1>Photo Tools</h1>
      <div class="header-spacer" />
      <Dropdown :trigger="['click']">
        <Button type="text" class="format-btn">
          Export: {{ exportFormat.toUpperCase() }}
          <DownOutlined />
        </Button>
        <template #overlay>
          <Menu @click="(info: { key: string | number }) => exportFormat = String(info.key) as ExportFormat">
            <Menu.Item key="png" :class="{ 'menu-item-active': exportFormat === 'png' }">PNG</Menu.Item>
            <Menu.Item key="jpg" :class="{ 'menu-item-active': exportFormat === 'jpg' }">JPG</Menu.Item>
          </Menu>
        </template>
      </Dropdown>
    </Layout.Header>

    <Layout class="app-body">
      <!-- Desktop sidebar - only for grid view -->
      <Layout.Sider v-if="!isMobile && showSidebar" width="300" theme="light" class="app-sider">
        <GridControls />

        <div class="sider-footer">
          <Button block @click="gridStore.resetGrid">
            <template #icon><ReloadOutlined /></template>
            Reset Grid
          </Button>
        </div>
      </Layout.Sider>

      <!-- Mobile drawer - only for grid view -->
      <Drawer
        v-if="showSidebar"
        v-model:open="drawerVisible"
        placement="left"
        title="Settings"
        :width="300"
      >
        <GridControls />

        <div class="drawer-footer">
          <Button block @click="gridStore.resetGrid">
            <template #icon><ReloadOutlined /></template>
            Reset Grid
          </Button>
        </div>
      </Drawer>

      <Layout.Content class="app-content">
        <Tabs v-model:activeKey="activeTab" class="app-tabs" centered>
          <Tabs.TabPane key="grid">
            <template #tab>
              <span class="tab-label">
                <AppstoreOutlined />
                Grid View
              </span>
            </template>
            <div class="tab-content">
              <Card class="grid-card">
                <PhotoGrid ref="photoGridRef" />
              </Card>

              <div class="export-container">
                <ExportButton :grid-element="photoGridRef?.gridRef ?? null" :format="exportFormat" />
              </div>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane key="splitter">
            <template #tab>
              <span class="tab-label">
                <ScissorOutlined />
                Photo Splitter
              </span>
            </template>
            <div class="tab-content">
              <PhotoSplitter :export-format="exportFormat" />
            </div>
          </Tabs.TabPane>
        </Tabs>
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

.header-spacer {
  flex: 1;
}

.format-btn {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.format-btn:hover {
  color: #fff;
}

.menu-btn {
  color: #fff;
  font-size: 18px;
}

.menu-btn:hover {
  color: #40a9ff;
}

.drawer-footer {
  padding: 16px 0;
  margin-top: 24px;
  border-top: 1px solid #f0f0f0;
}

.app-body {
  flex: 1;
}

.app-sider {
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}

.app-sider :deep(.ant-layout-sider-children) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sider-footer {
  padding: 16px;
  margin-top: auto;
  border-top: 1px solid #f0f0f0;
}

.app-content {
  padding: 0;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.app-tabs {
  flex: 1;
}

.app-tabs :deep(.ant-tabs-nav) {
  background: #fff;
  margin-bottom: 0;
  padding: 0 16px;
}

.app-tabs :deep(.ant-tabs-content-holder) {
  background: #f5f5f5;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
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
  max-width: 600px;
}

.grid-card :deep(.ant-card-body) {
  padding: 24px;
}

.export-container {
  display: flex;
  justify-content: center;
}

@media (max-width: 767px) {
  .app-header {
    padding: 0 16px;
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
</style>
