<script setup lang="ts">
import { ref } from 'vue';
import { useDbStore } from './stores/db';
import ConnectionForm from './components/ConnectionForm.vue';
import DatabaseExplorer from './components/DatabaseExplorer.vue';
import SqlEditor from './components/SqlEditor.vue';

const dbStore = useDbStore();
const activeTab = ref('explorer');
const showConnectionDialog = ref(false);

const handleConnected = () => {
  showConnectionDialog.value = false;
};
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>You My SQL</h1>
      <div class="header-actions">
        <el-button type="primary" @click="showConnectionDialog = true">
          New Connection
        </el-button>
      </div>
    </header>
    
    <main class="app-content">
      <el-tabs v-model="activeTab" class="main-tabs">
        <el-tab-pane label="Database Explorer" name="explorer">
          <DatabaseExplorer />
        </el-tab-pane>
        
        <el-tab-pane label="SQL Editor" name="editor">
          <SqlEditor />
        </el-tab-pane>
      </el-tabs>
    </main>
    
    <el-dialog
      v-model="showConnectionDialog"
      title="New Database Connection"
      width="600px"
    >
      <ConnectionForm @connected="handleConnected" />
    </el-dialog>
  </div>
</template>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
}

#app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.app-content {
  flex: 1;
  overflow: hidden;
}

.main-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding: 0;
  height: calc(100% - 40px);
}

.main-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow: hidden;
}
</style>