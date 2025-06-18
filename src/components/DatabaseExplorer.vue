<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDbStore } from '../stores/db';
import type { ConnectionConfig, QueryResult } from '../stores/db.types';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Codemirror } from 'vue-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

// Define props
const props = defineProps({
  viewMode: {
    type: String,
    default: 'both', // 'both', 'tables', or 'query'
  }
});

// Define emits
const emit = defineEmits(['update:view-mode']);

// Create a local viewMode ref that syncs with the prop
const viewMode = computed({
  get: () => props.viewMode,
  set: (value) => emit('update:view-mode', value)
});

// Update view mode function is no longer needed with the computed property approach

const dbStore = useDbStore();

const activeConnection = computed<ConnectionConfig | null>(() => {
  if (!dbStore.activeConnectionId) return null;
  return dbStore.connections.find(conn => conn.id === dbStore.activeConnectionId) || null;
});

const connectingId = ref<string | null>(null);
const getConnectionStatus = (connectionId: string) => {
  if (connectingId.value === connectionId) return 'connecting';
  if (activeConnection.value?.id === connectionId) return 'connected';
  return 'disconnected';
};

const connectionStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    'connected': 'Connected',
    'connecting': 'Connecting...',
    'disconnected': 'Disconnected'
  };
  return statusMap[status] || status;
};

const connectionStatusClass = (status: string) => {
  const classMap: Record<string, string> = {
    'connected': 'status-connected',
    'connecting': 'status-connecting',
    'disconnected': 'status-disconnected'
  };
  return classMap[status] || '';
};

const isConnectionActive = (connId: string) => {
  return activeConnection.value?.id === connId;
};

const isLoading = computed(() => dbStore.isLoading);
const schemas = computed(() => dbStore.schemas);
const tables = computed(() => dbStore.tables);
const selectedSchema = computed(() => dbStore.selectedSchema);
const selectedTable = computed(() => dbStore.selectedTable);
const tableData = computed(() => dbStore.tableData);

const rowLimit = ref(100);

const selectSchema = async (schema: string) => {
  try {
    await dbStore.selectSchema(schema);
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
  } catch (error) {
    ElMessage.error('Failed to disconnect: ' + (error instanceof Error ? error.message : String(error)));
  }
};

const connectToSaved = async (connection: any) => {
  try {
    connectingId.value = connection.id;

    // If this is already the active connection, do nothing
    if (dbStore.activeConnectionId === connection.id) {
      return;
    }

    // Use setActiveConnection if we already have this connection
    const existingConnection = dbStore.connections.find(conn =>
      conn.host === connection.host &&
      conn.port === connection.port &&
      conn.username === connection.username &&
      conn.schema === connection.schema
    );

    if (existingConnection) {
      // If schema is specified, update it in the existing connection
      if (connection.schema) {
        existingConnection.schema = connection.schema;
      }
      await dbStore.setActiveConnection(existingConnection.id);
    } else {
      // Create a new connection if it doesn't exist
      const connectionConfig = (connection: any) => ({
        name: connection.name,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        schema: connection.schema,
        jdbc_url: connection.jdbc_url
      });

      await dbStore.addConnection(connectionConfig(connection));
    }
  } catch (error) {
    ElMessage.error('Failed to connect: ' + (error instanceof Error ? error.message : String(error)));
  } finally {
    connectingId.value = null;
  }
};

const removeSavedConnection = async (connectionId: string) => {
  try {
    await ElMessageBox.confirm('Are you sure you want to remove this connection?', 'Confirm', {
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      type: 'warning',
    });
    // If this is the active connection, disconnect first
    if (dbStore.activeConnectionId === connectionId) {
      await dbStore.closeConnection(connectionId);
    }
    dbStore.connections = dbStore.connections.filter(conn => conn.id !== connectionId);
    await dbStore.saveConnectionsToConfig();
    ElMessage.success('Connection removed');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Failed to remove connection: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
};

// Calculate sequence number column width based on total rows
const getSeqColWidth = () => {
  if (!tableData.value?.rows?.length) return '60px';
  const digits = Math.floor(Math.log10(tableData.value.rows.length)) + 1;
  // Base width + some padding (10px per digit + 20px padding)
  return `${Math.max(40, digits * 10 + 20)}px`;
};

// Check if a column is likely to be variable length (text, varchar, etc.)
const isVariableLength = (columnName: string) => {
  const lowerName = columnName.toLowerCase();
  return lowerName.includes('content') ||
    lowerName.includes('text') ||
    lowerName.includes('desc') ||
    lowerName.includes('comment') ||
    lowerName.includes('detail');
};

// Check if a column is likely to be a date/time field
const isDateTimeField = (columnName: string) => {
  const lowerName = columnName.toLowerCase();
  return lowerName.includes('time') ||
    lowerName.includes('date') ||
    lowerName.includes('create') ||
    lowerName.includes('update') ||
    lowerName.includes('modif');
};

// Watch for changes in rowLimit and refresh data if needed
watch(rowLimit, async (newLimit, oldLimit) => {
  if (newLimit !== oldLimit && selectedTable.value) {
    await refreshTableData();
  }
});

// Quick SQL Query functionality
const quickSqlQuery = ref('');
const quickQueryResult = ref<QueryResult | null>(null);
const sqlExtensions = [sql(), oneDark];

const executeQuickQuery = async () => {
  if (!activeConnection.value) {
    ElMessage.warning('Please connect to a database first');
    return;
  }
  
  if (!quickSqlQuery.value.trim()) {
    ElMessage.warning('Please enter a SQL query');
    return;
  }
  
  try {
    const result = await dbStore.executeQuery(quickSqlQuery.value);
    if (result) {
      quickQueryResult.value = result;
    } else if (dbStore.error) {
      ElMessage.error(dbStore.error);
    }
  } catch (error) {
    ElMessage.error('Failed to execute query: ' + (error instanceof Error ? error.message : String(error)));
  }
};

const formatQuickQuery = () => {
  // Simple SQL formatting - in a real app, you might use a library for this
  const formatted = quickSqlQuery.value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*<\s*/g, ' < ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\s*;\s*/g, ';')
    .replace(/SELECT/gi, 'SELECT')
    .replace(/FROM/gi, '\nFROM')
    .replace(/WHERE/gi, '\nWHERE')
    .replace(/ORDER BY/gi, '\nORDER BY')
    .replace(/GROUP BY/gi, '\nGROUP BY')
    .replace(/HAVING/gi, '\nHAVING')
    .replace(/LIMIT/gi, '\nLIMIT')
    .replace(/JOIN/gi, '\nJOIN')
    .replace(/UNION/gi, '\nUNION')
    .trim();
    
  quickSqlQuery.value = formatted;
};

const copyQuickQuery = () => {
  navigator.clipboard.writeText(quickSqlQuery.value)
    .then(() => {
      ElMessage.success('SQL query copied to clipboard');
    })
    .catch(err => {
      ElMessage.error('Failed to copy: ' + err);
    });
};

const getQuickQueryResultText = () => {
  if (!quickQueryResult.value) return '';
  
  if (quickQueryResult.value.affected_rows > 0) {
    return `${quickQueryResult.value.affected_rows} row${quickQueryResult.value.affected_rows > 1 ? 's' : ''} affected`;
  }
  
  return quickQueryResult.value.rows.length > 0 
    ? `${quickQueryResult.value.rows.length} row${quickQueryResult.value.rows.length > 1 ? 's' : ''} returned` 
    : 'Query executed successfully';
};

// Initialize quick SQL query with a SELECT statement for the selected table when a table is selected
watch(selectedTable, (newTable) => {
  if (newTable && selectedSchema.value) {
    quickSqlQuery.value = `SELECT * FROM ${selectedSchema.value}.${newTable} LIMIT 100;`;
    // Reset previous query result
    quickQueryResult.value = null;
  }
});
</script>

<template>
  <div class="database-explorer">
    <div v-if="!activeConnection" class="no-connection">
      <div v-if="dbStore.connections.length > 0" class="saved-connections">
        <h3>Saved Connections</h3>
        <el-card v-for="conn in dbStore.connections" :key="conn.id" class="connection-card"
          :class="{ 'connection-card-active': isConnectionActive(conn.id) }">
          <div class="connection-card-header">
            <div class="connection-title">
              <h4>{{ conn.name }}</h4>
              <span class="status-badge" :class="connectionStatusClass(getConnectionStatus(conn.id))">
                {{ connectionStatusText(getConnectionStatus(conn.id)) }}
              </span>
            </div>
            <div class="connection-details">
              <div class="connection-detail">
                <el-icon>
                  <Connection />
                </el-icon>
                <span>Database: {{ conn.jdbc_url ? conn.jdbc_url : `${conn.host}:${conn.port}` }}</span>
              </div>
              <div v-if="conn.schema" class="connection-detail">
                <el-icon>
                  <Folder />
                </el-icon>
                <span>Schema: {{ conn.schema }}</span>
              </div>
            </div>
          </div>
          <div class="connection-card-actions">
            <el-button type="primary" size="small" @click="connectToSaved(conn)" :loading="connectingId === conn.id"
              :disabled="isConnectionActive(conn.id)">
              {{ isConnectionActive(conn.id) ? 'Connected' : 'Connect' }}
            </el-button>
            <el-button type="danger" size="small" @click="removeSavedConnection(conn.id)"
              :disabled="connectingId === conn.id">
              Remove
            </el-button>
          </div>
        </el-card>
      </div>
      <el-empty v-else description="No saved database connections" />
    </div>

    <template v-else>
      <div class="explorer-header">
        <div class="connection-header">
          <h2 v-if="activeConnection">{{ activeConnection.name }}</h2>
          <span class="connection-status status-connected">
            <el-icon>
              <SuccessFilled />
            </el-icon>
            Connected
          </span>
        </div>
        <div class="connection-details-active" v-if="activeConnection">
          <div class="connection-detail">
            <el-icon>
              <Connection />
            </el-icon>
            <span>{{ activeConnection.jdbc_url || `${activeConnection.host}:${activeConnection.port}` }}</span>
          </div>
        </div>
        <el-button v-if="activeConnection" type="danger" size="small" @click="disconnectDatabase" :loading="isLoading"
          plain>
          <el-icon>
            <Connection />
          </el-icon>
          <span>Disconnect</span>
        </el-button>
      </div>

      <div class="explorer-content">
        <div class="sidebar">
          <div class="database-list">
            <h3>Schemas</h3>
            <el-menu :default-active="selectedSchema || ''" @select="selectSchema" class="database-menu">
              <el-menu-item v-for="schema in schemas" :key="schema" :index="schema">
                <span>{{ schema }}</span>
              </el-menu-item>
            </el-menu>
          </div>

          <div v-if="selectedSchema" class="table-list">
            <h3>Tables in {{ selectedSchema }}</h3>
            <el-menu :default-active="selectedTable || ''" @select="selectTable" class="table-menu">
              <el-menu-item v-for="table in tables" :key="table" :index="table">
                {{ table }}
              </el-menu-item>
            </el-menu>
          </div>
        </div>

        <div class="data-view">
          <template v-if="selectedTable && tableData">
            <div class="data-header">
              <h3>{{ selectedTable }}</h3>
              <div class="view-mode-controls">
                <el-radio-group v-model="viewMode" size="small">
                  <el-radio-button label="both">Both</el-radio-button>
                  <el-radio-button label="tables">Tables Only</el-radio-button>
                  <el-radio-button label="query">Query Only</el-radio-button>
                </el-radio-group>
              </div>
              <div class="data-controls">
                <span>Showing {{ tableData.rows.length }} rows</span>
                <el-input-number v-model="rowLimit" :min="10" :max="1000" :step="10" size="small"
                  @change="refreshTableData" />
                <el-button type="primary" size="small" @click="refreshTableData" :loading="isLoading">
                  Refresh
                </el-button>
              </div>
            </div>

            <!-- Table Data Section - Show when viewMode is 'both' or 'tables' -->
            <div v-if="viewMode === 'both' || viewMode === 'tables'" class="table-data-section">
              <el-table :data="tableData.rows" border style="width: 100%" max-height="600" v-loading="isLoading"
                size="small" class="data-table">
                <el-table-column type="index" label="#" :width="getSeqColWidth()" :min-width="getSeqColWidth()"
                  align="center" fixed class-name="sequence-column">
                  <template #default="scope">
                    {{ scope.$index + 1 }}
                  </template>
                </el-table-column>
                <el-table-column v-for="column in tableData.columns" :key="column" :prop="column" :label="column"
                  :width="isVariableLength(column) ? '300px' : (isDateTimeField(column) ? '180px' : '120px')"
                  :min-width="isVariableLength(column) ? '300px' : (isDateTimeField(column) ? '160px' : '100px')" sortable
                  show-overflow-tooltip :class-name="isDateTimeField(column) ? 'datetime-column' : ''">
                  <template #header="{ column }">
                    <span :class="{
                      'variable-field': isVariableLength(column.property),
                      'datetime-field': isDateTimeField(column.property)
                    }">
                      {{ column.label }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            
            <!-- SQL Query Section - Show when viewMode is 'both' or 'query' -->
            <div v-if="viewMode === 'both' || viewMode === 'query'" class="sql-query-section">
              <div class="sql-query-header">
                <h3>Quick SQL Query</h3>
                <div class="sql-query-controls">
                  <el-button 
                    type="primary" 
                    size="small"
                    @click="executeQuickQuery"
                    :loading="isLoading"
                  >
                    Execute
                  </el-button>
                  <el-button size="small" @click="formatQuickQuery">Format</el-button>
                  <el-button size="small" @click="copyQuickQuery">Copy</el-button>
                </div>
              </div>
              
              <div class="sql-query-editor">
                <Codemirror
                  v-model="quickSqlQuery"
                  placeholder="Enter your SQL query here..."
                  :indent-with-tab="true"
                  :tabSize="2"
                  :extensions="sqlExtensions"
                  class="resizable-editor"
                />
              </div>
              
              <div v-if="quickQueryResult" class="quick-query-results">
                <div class="results-header">
                  <h3>Results</h3>
                  <span class="affected-rows">{{ getQuickQueryResultText() }}</span>
                </div>
                
                <el-table 
                  v-if="quickQueryResult.columns.length > 0 && quickQueryResult.rows.length > 0"
                  :data="quickQueryResult.rows" 
                  border 
                  style="width: 100%"
                  max-height="300"
                  size="small"
                >
                  <el-table-column 
                    v-for="column in quickQueryResult.columns" 
                    :key="column"
                    :prop="column"
                    :label="column"
                    sortable
                  />
                </el-table>
                
                <div v-else-if="quickQueryResult.affected_rows > 0" class="no-results">
                  <el-result 
                    icon="success"
                    :title="`${quickQueryResult.affected_rows} row${quickQueryResult.affected_rows > 1 ? 's' : ''} affected`"
                    sub-title="Query executed successfully"
                  />
                </div>
                
                <div v-else class="no-results">
                  <el-empty description="No results returned" />
                </div>
              </div>
            </div>
          </template>

          <el-empty v-else-if="selectedSchema" description="Select a table to view data" />

          <el-empty v-else description="Select a schema to view tables" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Global table styles */
:deep(.el-table) {
  font-size: 12px;
}

:deep(.el-table th) {
  padding: 4px 0;
  white-space: nowrap;
  overflow: visible;
  height: auto;
  line-height: 1.4;
}

:deep(.el-table td) {
  padding: 4px 0;
  line-height: 1.2;
  white-space: normal;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-table .el-table__fixed-right) {
  height: 100% !important;
}

:deep(.el-table .el-table__fixed-body-wrapper) {
  height: calc(100% - 40px) !important;
}

:deep(.el-table .el-table__fixed) {
  height: 100% !important;
}

:deep(.el-table .cell) {
  padding: 0 8px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

:deep(.el-table th > .cell) {
  white-space: nowrap;
  overflow: visible;
  text-overflow: ellipsis;
  line-height: 1.4;
  padding: 8px 0;
  display: inline-block;
  max-width: 100%;
}

:deep(.el-table .variable-field) {
  font-weight: 500;
}

:deep(.el-table .datetime-field) {
  white-space: nowrap;
}

:deep(.el-table .sequence-column) {
  background-color: #f8f9fa;
}

:deep(.el-table .datetime-column) {
  white-space: nowrap;
}

:deep(.el-table--border .cell) {
  padding: 0 8px;
}

:deep(.el-table--border th) {
  padding: 4px 0;
}

:deep(.el-table--border td) {
  padding: 4px 0;
}

:deep(.el-table--enable-row-hover .el-table__body tr:hover>td) {
  background-color: #f5f7fa;
}

/* Make table header slightly darker for better readability */
:deep(.el-table th) {
  background-color: #f8f9fa;
  color: #606266;
  font-weight: 500;
}

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
  margin-bottom: 20px;
  max-height: calc(100vh - 200px);
  /* Adjust based on your layout */
  overflow-y: auto;
  padding-right: 8px;
  /* Add some padding for scrollbar */
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.saved-connections::-webkit-scrollbar {
  width: 6px;
}

.saved-connections::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.saved-connections::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.saved-connections::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.saved-connections h3 {
  margin-bottom: 10px;
  font-size: 18px;
  color: #333;
}

.connection-card {
  margin-bottom: 16px;
  transition: all 0.3s ease;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
  /* Prevent cards from shrinking */
}

.connection-card-active {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.connection-card-header {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.connection-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.connection-details {
  font-size: 13px;
  color: #606266;
  margin-top: 8px;
}

.connection-detail {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  gap: 6px;
  color: #606266;
}

.connection-detail .el-icon {
  font-size: 14px;
  color: #909399;
}

.connection-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  background-color: #e6fbf7;
  border-top: 1px solid #f0f0f0;
}

.status-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.status-connected {
  color: #67c23a;
  background-color: rgba(103, 194, 58, 0.1);
}

.status-connecting {
  color: #e6a23c;
  background-color: rgba(230, 162, 60, 0.1);
}

.status-disconnected {
  color: #909399;
  background-color: rgba(144, 147, 153, 0.1);
}

.connection-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.connection-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  padding: 2px 8px;
  border-radius: 10px;
}

.connection-status .el-icon {
  font-size: 14px;
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
  display: flex;
  flex-direction: column;
}

.data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
}

.data-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.view-mode-controls {
  margin-left: 15px;
  margin-right: auto;
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

/* SQL Query Section Styles */
.sql-query-section {
  margin-top: 20px;
  border-top: 1px solid #eee;
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; /* Important for flex child to respect parent's height */
  height: calc(100vh - 350px); /* Viewport height minus header, tabs, and table section */
}

.sql-query-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  height: 40px;
  min-height: 40px;
}

.sql-query-controls {
  display: flex;
  gap: 10px;
}

.sql-query-editor {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
  position: relative;
  flex: 1;
  min-height: 0; /* Important for flex child to respect parent's height */
  display: flex;
  flex-direction: column;
  height: calc(100vh - 400px); /* Viewport height minus all other elements */
}

.resizable-editor {
  height: 100% !important;
  min-height: calc(100vh - 350px); /* Subtract header, table section, and padding */
  overflow: auto;
  flex: 1;
}

:deep(.resizable-editor .cm-editor) {
  height: 100%;
  overflow: auto;
}

:deep(.resizable-editor .cm-scroller) {
  overflow: auto;
}

.quick-query-results {
  margin-top: 15px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.affected-rows {
  font-size: 14px;
  color: #666;
}

/* Adjust heights based on view mode */
.data-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
}

.table-data-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flex child to respect parent's height */
  overflow: auto;
  margin-bottom: 20px;
}

.data-table {
  flex: 1;
}

/* When only tables are shown, give them more space */
.data-view:has(.table-data-section:only-child) .table-data-section {
  max-height: none;
}

/* When only query is shown, give it more space */
.data-view:has(.sql-query-section:only-child) .sql-query-editor :deep(.cm-editor) {
  height: 300px !important;
}

.data-view:has(.sql-query-section:only-child) .quick-query-results :deep(.el-table) {
  max-height: 500px !important;
}
</style>