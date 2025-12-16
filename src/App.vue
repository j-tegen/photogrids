<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Layout, Card, Button, Drawer } from 'ant-design-vue'
import { ReloadOutlined, MenuOutlined } from '@ant-design/icons-vue'
import GridControls from './components/GridControls.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import ExportButton from './components/ExportButton.vue'
import { useGridStore } from './stores/gridStore'

const gridStore = useGridStore()
const photoGridRef = ref<InstanceType<typeof PhotoGrid> | null>(null)

const MOBILE_BREAKPOINT = 768
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)
const drawerVisible = ref(false)

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
        v-if="isMobile"
        type="text"
        class="menu-btn"
        @click="drawerVisible = true"
      >
        <template #icon><MenuOutlined /></template>
      </Button>
      <h1>Photo Grid Generator</h1>
    </Layout.Header>

    <Layout class="app-body">
      <!-- Desktop sidebar -->
      <Layout.Sider v-if="!isMobile" width="300" theme="light" class="app-sider">
        <GridControls />

        <div class="sider-footer">
          <Button block @click="gridStore.resetGrid">
            <template #icon><ReloadOutlined /></template>
            Reset Grid
          </Button>
        </div>
      </Layout.Sider>

      <!-- Mobile drawer -->
      <Drawer
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
        <Card class="grid-card">
          <PhotoGrid ref="photoGridRef" />
        </Card>

        <div class="export-container">
          <ExportButton :grid-element="photoGridRef?.gridRef ?? null" />
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
  padding: 24px;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.grid-card {
  width: 100%;
  max-width: 900px;
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

  .app-content {
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
</style>
