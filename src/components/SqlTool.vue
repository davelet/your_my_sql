<script setup lang="ts">
import { ref, computed } from 'vue';
import { Codemirror } from 'vue-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { formatSqlQuery } from '../utils/sqlUtils';
import { copyToClipboard } from '../utils/clipboardUtils';

const DEFAULT_SQL_QUERY = 'SELECT * FROM ';

const sqlQuery = ref(DEFAULT_SQL_QUERY);

const isDefaultQuery = computed(() => sqlQuery.value === DEFAULT_SQL_QUERY);

const handleReset = () => {
  sqlQuery.value = isDefaultQuery.value ? '' : DEFAULT_SQL_QUERY;
};

// CodeMirror extensions
const extensions = [sql(), oneDark];

const formatQuery = () => {
  sqlQuery.value = formatSqlQuery(sqlQuery.value);
};

const copyQuery = () => {
  copyToClipboard(sqlQuery.value, 'SQL query copied to clipboard', 'Failed to copy');
};

</script>

<template>
  <div class="sql-tool">
    <div class="editor-header">
      <h2>SQL Tool</h2>
    </div>
    
    <div class="editor-container">
      <Codemirror
        v-model="sqlQuery"
        placeholder="Enter your SQL query here..."
        :autofocus="true"
        :indent-with-tab="true"
        :tabSize="2"
        :extensions="extensions"
        class="resizable-editor"
      />
    </div>

    <div class="editor-controls">
      <el-button @click="formatQuery">Format</el-button>
      <el-button @click="copyQuery">Copy</el-button>
      <el-button @click="handleReset">
        {{ isDefaultQuery ? 'Clear' : 'Reset' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.sql-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 0;
}

.editor-header {
  padding: 10px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  min-height: 60px;
}

.editor-controls {
  display: flex;
  gap: 10px;
  margin: 15px 0 0 20px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.editor-container {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin: 0;
  padding: 0;
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}


.resizable-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.resizable-editor .cm-editor) {
  height: 100%;
}

:deep(.resizable-editor .cm-scroller) {
  overflow-y: auto !important;
  height: 100%;
}

</style>