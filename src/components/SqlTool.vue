<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Codemirror } from 'vue-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

const DEFAULT_SQL_QUERY = 'SELECT * FROM ';

const sqlQuery = ref(DEFAULT_SQL_QUERY);

const isDefaultQuery = computed(() => sqlQuery.value === DEFAULT_SQL_QUERY);

const handleReset = () => {
  sqlQuery.value = isDefaultQuery.value ? '' : DEFAULT_SQL_QUERY;
};

// CodeMirror extensions
const extensions = [sql(), oneDark];

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

const copyQuery = () => {
  navigator.clipboard.writeText(sqlQuery.value)
    .then(() => {
      ElMessage.success('SQL query copied to clipboard');
    })
    .catch(err => {
      ElMessage.error('Failed to copy: ' + err);
    });
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

.query-results {
  flex: 1;
  padding: 10px;
  overflow: auto;
  border-top: 1px solid #eee;
  margin-top: 10px;
}
</style>