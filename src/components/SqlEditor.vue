<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDbStore } from '../stores/db';
import { ElMessage } from 'element-plus';
import { Codemirror } from 'vue-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

const dbStore = useDbStore();

const sqlQuery = ref('SELECT * FROM ');
const queryResult = computed(() => dbStore.queryResult);
const isExecuting = computed(() => dbStore.isLoading);
const activeConnection = computed(() => {
  if (!dbStore.activeConnectionId) return null;
  return dbStore.connections.find(conn => conn.id === dbStore.activeConnectionId) || null;
});

// CodeMirror extensions
const extensions = [sql(), oneDark];

const executeQuery = async () => {
  if (!activeConnection.value) {
    ElMessage.warning('Please connect to a database first');
    return;
  }
  
  if (!sqlQuery.value.trim()) {
    ElMessage.warning('Please enter a SQL query');
    return;
  }
  
  try {
    await dbStore.executeQuery(sqlQuery.value);
    if (dbStore.error) {
      ElMessage.error(dbStore.error);
    }
  } catch (error) {
    ElMessage.error('Failed to execute query: ' + (error instanceof Error ? error.message : String(error)));
  }
};

const clearResults = () => {
  dbStore.clearQueryResult();
};

const formatQuery = () => {
  // Simple SQL formatting - in a real app, you might use a library for this
  const formatted = sqlQuery.value
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
    
  sqlQuery.value = formatted;
};

const getAffectedRowsText = () => {
  if (!queryResult.value) return '';
  
  if (queryResult.value.affected_rows > 0) {
    return `${queryResult.value.affected_rows} row${queryResult.value.affected_rows > 1 ? 's' : ''} affected`;
  }
  
  return queryResult.value.rows.length > 0 
    ? `${queryResult.value.rows.length} row${queryResult.value.rows.length > 1 ? 's' : ''} returned` 
    : 'Query executed successfully';
};
</script>

<template>
  <div class="sql-editor">
    <div class="editor-header">
      <h2>SQL Editor</h2>
      <div class="editor-controls">
        <el-button 
          type="primary" 
          @click="executeQuery"
          :disabled="!activeConnection"
          :loading="isExecuting"
        >
          Execute
        </el-button>
        <el-button @click="formatQuery">Format</el-button>
        <el-button @click="clearResults" :disabled="!queryResult">Clear Results</el-button>
      </div>
    </div>
    
    <div class="editor-container">
      <Codemirror
        v-model="sqlQuery"
        placeholder="Enter your SQL query here..."
        :style="{ height: '200px' }"
        :autofocus="true"
        :indent-with-tab="true"
        :tabSize="2"
        :extensions="extensions"
      />
    </div>
    
    <div v-if="queryResult" class="query-results">
      <div class="results-header">
        <h3>Results</h3>
        <span class="affected-rows">{{ getAffectedRowsText() }}</span>
      </div>
      
      <el-table 
        v-if="queryResult.columns.length > 0 && queryResult.rows.length > 0"
        :data="queryResult.rows" 
        border 
        style="width: 100%"
        max-height="400"
      >
        <el-table-column 
          v-for="column in queryResult.columns" 
          :key="column"
          :prop="column"
          :label="column"
          sortable
        />
      </el-table>
      
      <div v-else-if="queryResult.affected_rows > 0" class="no-results">
        <el-result 
          icon="success"
          :title="`${queryResult.affected_rows} row${queryResult.affected_rows > 1 ? 's' : ''} affected`"
          sub-title="Query executed successfully"
        />
      </div>
      
      <div v-else class="no-results">
        <el-empty description="No results returned" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sql-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  padding: 10px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-controls {
  display: flex;
  gap: 10px;
}

.editor-container {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin: 10px;
}

.query-results {
  flex: 1;
  padding: 10px;
  overflow: auto;
  border-top: 1px solid #eee;
  margin-top: 10px;
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

.no-results {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}
</style>