<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDbStore } from '../stores/db';
import { ElMessage } from 'element-plus';

const dbStore = useDbStore();

const activeConnection = computed(() => {
  if (!dbStore.activeConnectionId) return null;
  return dbStore.connections.find(conn => conn.id === dbStore.activeConnectionId) || null;
});

const isLoading = computed(() => dbStore.isLoading);
const databases = computed(() => dbStore.databases);
const tables = computed(() => dbStore.tables);
const selectedDatabase = computed(() => dbStore.selectedDatabase);
const selectedTable = computed(() => dbStore.selectedTable);
const tableData = computed(() => dbStore.tableData);

const rowLimit = ref(100);

const selectDatabase = async (database: string) => {
  try {
    await dbStore.selectDatabase(database);
  } catch (error) {
    ElMessage.error('Failed to load tables: ' + (error instanceof Error ? error.message : String(error)));
  }
};

const selectTable = async (table: string) => {
  try {
    await dbStore.selectTable(table, rowLimit.value);
  } catch (error) {
    ElMessage.error('Failed to load table data: ' + (error instanceof Error ? error.message : String(error)));
  }
};

const refreshTableData = async () => {
  if (selectedTable.value) {
    await selectTable(selectedTable.value);
  }
};

const disconnectDatabase = async () => {
  try {
    await dbStore.closeConnection();
    ElMessage.success('Disconnected successfully');
  } catch (error) {
    ElMessage.error('Failed to disconnect: ' + (error instanceof Error ? error.message : String(error)));
  }
};

// Watch for changes in rowLimit and refresh data if needed
watch(rowLimit, async (newLimit, oldLimit) => {
  if (newLimit !== oldLimit && selectedTable.value) {
    await refreshTableData();
  }
});
</script>

<template>
  <div class="database-explorer">
    <div v-if="!activeConnection" class="no-connection">
      <el-empty description="No active database connection" />
    </div>
    
    <template v-else>
      <div class="explorer-header">
        <h2>{{ activeConnection.name }}</h2>
        <div class="connection-info">
          {{ activeConnection.username }}@{{ activeConnection.host }}:{{ activeConnection.port }}
          <el-button 
            type="danger" 
            size="small" 
            @click="disconnectDatabase"
            :loading="isLoading"
          >
            Disconnect
          </el-button>
        </div>
      </div>
      
      <div class="explorer-content">
        <div class="sidebar">
          <div class="database-list">
            <h3>Databases</h3>
            <el-menu
              :default-active="selectedDatabase || ''"
              @select="selectDatabase"
              class="database-menu"
            >
              <el-menu-item 
                v-for="db in databases" 
                :key="db" 
                :index="db"
              >
                {{ db }}
              </el-menu-item>
            </el-menu>
          </div>
          
          <div v-if="selectedDatabase" class="table-list">
            <h3>Tables in {{ selectedDatabase }}</h3>
            <el-menu
              :default-active="selectedTable || ''"
              @select="selectTable"
              class="table-menu"
            >
              <el-menu-item 
                v-for="table in tables" 
                :key="table" 
                :index="table"
              >
                {{ table }}
              </el-menu-item>
            </el-menu>
          </div>
        </div>
        
        <div class="data-view">
          <template v-if="selectedTable && tableData">
            <div class="data-header">
              <h3>{{ selectedTable }}</h3>
              <div class="data-controls">
                <span>Showing {{ tableData.rows.length }} rows</span>
                <el-input-number 
                  v-model="rowLimit" 
                  :min="10" 
                  :max="1000" 
                  :step="10"
                  size="small"
                  @change="refreshTableData"
                />
                <el-button 
                  type="primary" 
                  size="small" 
                  @click="refreshTableData"
                  :loading="isLoading"
                >
                  Refresh
                </el-button>
              </div>
            </div>
            
            <el-table 
              :data="tableData.rows" 
              border 
              style="width: 100%"
              max-height="600"
              v-loading="isLoading"
            >
              <el-table-column 
                v-for="column in tableData.columns" 
                :key="column"
                :prop="column"
                :label="column"
                sortable
              />
            </el-table>
          </template>
          
          <el-empty 
            v-else-if="selectedDatabase" 
            description="Select a table to view data"
          />
          
          <el-empty 
            v-else 
            description="Select a database to view tables"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.database-explorer {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.explorer-header {
  padding: 10px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #666;
}

.explorer-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  border-right: 1px solid #eee;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.database-list,
.table-list {
  padding: 10px;
}

.database-list h3,
.table-list h3 {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 500;
}

.database-menu,
.table-menu {
  border-right: none;
}

.data-view {
  flex: 1;
  padding: 10px;
  overflow: auto;
}

.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.data-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.no-connection {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>