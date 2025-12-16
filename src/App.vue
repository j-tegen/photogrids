<script setup lang="ts">
import { ref } from 'vue'
import { Layout, Card, Button } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import GridControls from './components/GridControls.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import ExportButton from './components/ExportButton.vue'
import { useGridStore } from './stores/gridStore'

const gridStore = useGridStore()
const photoGridRef = ref<InstanceType<typeof PhotoGrid> | null>(null)
</script>

<template>
  <Layout class="app-layout">
    <Layout.Header class="app-header">
      <h1>Photo Grid Generator</h1>
    </Layout.Header>

    <Layout class="app-body">
      <Layout.Sider width="300" theme="light" class="app-sider">
        <GridControls />

        <div class="sider-footer">
          <Button block @click="gridStore.resetGrid">
            <template #icon><ReloadOutlined /></template>
            Reset Grid
          </Button>
        </div>
      </Layout.Sider>

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
}

.app-header h1 {
  color: #fff;
  margin: 0;
  font-size: 20px;
  font-weight: 500;
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
