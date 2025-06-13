<script setup>
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const config = ref({
  theme: 'light',
  font_size: 14,
  show_line_numbers: true,
  max_rows_display: 100,
  recent_connections: []
});

const loading = ref(true);
const saveStatus = ref('');

onMounted(async () => {
  try {
    const response = await invoke('get_app_config');
    if (response.success && response.data) {
      config.value = response.data;
    } else if (response.error) {
      console.error('Error loading config:', response.error);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  } finally {
    loading.value = false;
  }
});

async function saveConfig() {
  try {
    saveStatus.value = 'Saving...';
    const response = await invoke('save_app_config', { config: config.value });
    if (response.success) {
      saveStatus.value = 'Settings saved successfully!';
      setTimeout(() => {
        saveStatus.value = '';
      }, 3000);
    } else if (response.error) {
      saveStatus.value = `Error: ${response.error}`;
    }
  } catch (error) {
    saveStatus.value = `Error: ${error.message || 'Unknown error'}`;
    console.error('Failed to save config:', error);
  }
}
</script>

<template>
  <div class="config-settings">
    <h2>Application Settings</h2>
    
    <div v-if="loading" class="loading">
      Loading settings...
    </div>
    
    <form v-else @submit.prevent="saveConfig" class="settings-form">
      <div class="form-group">
        <label for="theme">Theme:</label>
        <select id="theme" v-model="config.theme">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="font-size">Font Size:</label>
        <input 
          id="font-size" 
          type="number" 
          v-model.number="config.font_size" 
          min="8" 
          max="24"
        />
      </div>
      
      <div class="form-group checkbox">
        <input 
          id="line-numbers" 
          type="checkbox" 
          v-model="config.show_line_numbers"
        />
        <label for="line-numbers">Show Line Numbers</label>
      </div>
      
      <div class="form-group">
        <label for="max-rows">Max Rows to Display:</label>
        <input 
          id="max-rows" 
          type="number" 
          v-model.number="config.max_rows_display" 
          min="10" 
          max="1000"
        />
      </div>
      
      <div class="form-actions">
        <button type="submit" class="save-button">Save Settings</button>
        <span v-if="saveStatus" class="save-status">{{ saveStatus }}</span>
      </div>
    </form>
  </div>
</template>

<style scoped>
.config-settings {
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

label {
  font-weight: 500;
}

input, select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.save-button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.save-button:hover {
  background-color: #45a049;
}

.save-status {
  font-size: 0.9rem;
}
</style>