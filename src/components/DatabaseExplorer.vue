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

const connectToSaved = async (connection: any) => {
  try {
    // We need to reconnect to the database using the saved credentials
    const connectionConfig = {
      name: connection.name,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      database: connection.database,
      jdbc_url: connection.jdbc_url
    };
    
    await dbStore.addConnection(connectionConfig);
    ElMessage.success('Connected successfully');
  } catch (error) {
    ElMessage.error('Failed to connect: ' + (error instanceof Error ? error.message : String(error)));
  }
};

const removeSavedConnection = async (connectionId: string) => {
  try {
    // If this is the active connection, disconnect first
    if (dbStore.activeConnectionId === connectionId) {
      await dbStore.closeConnection(connectionId);
      // Since closeConnection no longer removes the connection, we need to do it manually
      dbStore.connections = dbStore.connections.filter(conn => conn.id !== connectionId);
      await dbStore.saveConnectionsToConfig();
    } else {
      // Just remove from the connections list
      dbStore.connections = dbStore.connections.filter(conn => conn.id !== connectionId);
      await dbStore.saveConnectionsToConfig();
    }
    
    ElMessage.success('Connection removed');
  } catch (error) {
    ElMessage.error('Failed to remove connection: ' + (error instanceof Error ? error.message : String(error)));
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
      <div v-if="dbStore.connections.length > 0" class="saved-connections">
        <h3>Saved Connections</h3>
        <el-card v-for="conn in dbStore.connections" :key="conn.id" class="connection-card">
          <div class="connection-card-header">
            <h4>{{ conn.name }}</h4>
            <div class="connection-details">
              {{ conn.jdbc_url ? conn.jdbc_url : `${conn.username}@${conn.host}:${conn.port}` }}
              {{ conn.database ? `/ ${conn.database}` : '' }}
            </div>
          </div>
          <div class="connection-card-actions">
            <el-button type="primary" size="small" @click="connectToSaved(conn)" :loading="isLoading">
              Connect
            </el-button>
            <el-button type="danger" size="small" @click="removeSavedConnection(conn.id)">
              Remove
            </el-button>
          </div>
        </el-card>
      </div>
      <el-empty v-else description="No saved database connections" />
    </div>
    
    <template v-else>
      <div class="explorer-header">
        <h2>{{ activeConnection.name }}</h2>
        <div class="connection-info">
          {{ activeConnection.jdbc_url ? activeConnection.jdbc_url : `${activeConnection.username}@${activeConnection.host}:${activeConnection.port}` }}
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

.no-connection {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.saved-connections {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.saved-connections h3 {
  margin-bottom: 10px;
  font-size: 18px;
  color: #333;
}

.connection-card {
  margin-bottom: 10px;
}

.connection-card-header {
  margin-bottom: 10px;
}

.connection-card-header h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
  color: #333;
}

.connection-details {
  font-size: 14px;
  color: #666;
}

.connection-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
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

.table-list {
  max-height: 50%;
  overflow-y: auto;
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

/* Enhance the selected item background color */
:deep(.el-menu-item.is-active) {
  background-color: #ecf5ff !important;
  color: #409eff !important;
  font-weight: bold;
}

:deep(.el-menu-item:hover) {
  background-color: #f5f7fa;
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