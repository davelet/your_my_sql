<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useDbStore } from '../stores/db';
import { ElMessage } from 'element-plus';

const dbStore = useDbStore();

const formData = reactive({
  name: '',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '',
  database: ''
});

const isConnecting = ref(false);
const formRef = ref();

const rules = {
  name: [{ required: true, message: 'Please enter a connection name', trigger: 'blur' }],
  host: [{ required: true, message: 'Please enter a host', trigger: 'blur' }],
  port: [{ required: true, message: 'Please enter a port', trigger: 'blur' }],
  username: [{ required: true, message: 'Please enter a username', trigger: 'blur' }]
};

const emit = defineEmits(['connected']);

const connect = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    
    isConnecting.value = true;
    
    try {
      const connectionId = await dbStore.addConnection({
        name: formData.name,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        password: formData.password,
        database: formData.database || undefined
      });
      
      if (connectionId) {
        ElMessage.success('Connected successfully');
        emit('connected', connectionId);
        resetForm();
      } else if (dbStore.error) {
        ElMessage.error(dbStore.error);
      }
    } catch (error) {
      ElMessage.error('Failed to connect: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      isConnecting.value = false;
    }
  });
};

const resetForm = () => {
  if (!formRef.value) return;
  formRef.value.resetFields();
  formData.name = '';
  formData.host = 'localhost';
  formData.port = 3306;
  formData.username = 'root';
  formData.password = '';
  formData.database = '';
};
</script>

<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="rules"
    label-width="120px"
    class="connection-form"
  >
    <el-form-item label="Connection Name" prop="name">
      <el-input v-model="formData.name" placeholder="My Database" />
    </el-form-item>
    
    <el-form-item label="Host" prop="host">
      <el-input v-model="formData.host" placeholder="localhost" />
    </el-form-item>
    
    <el-form-item label="Port" prop="port">
      <el-input-number v-model="formData.port" :min="1" :max="65535" />
    </el-form-item>
    
    <el-form-item label="Username" prop="username">
      <el-input v-model="formData.username" placeholder="root" />
    </el-form-item>
    
    <el-form-item label="Password" prop="password">
      <el-input v-model="formData.password" type="password" placeholder="Password" show-password />
    </el-form-item>
    
    <el-form-item label="Database" prop="database">
      <el-input v-model="formData.database" placeholder="(optional)" />
    </el-form-item>
    
    <el-form-item>
      <el-button type="primary" @click="connect" :loading="isConnecting">Connect</el-button>
      <el-button @click="resetForm">Reset</el-button>
    </el-form-item>
  </el-form>
</template>

<style scoped>
.connection-form {
  max-width: 500px;
  margin: 0 auto;
}
</style>