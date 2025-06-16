<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useDbStore } from '../stores/db';
import { ElMessage } from 'element-plus';

const dbStore = useDbStore();

const formData = reactive({
  name: '',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '',
  database: '',
  schema: '',
  jdbc_url: '',
  connection_type: 'standard' // 'standard' or 'jdbc'
});

const useJdbcUrl = ref(false);

const isConnecting = ref(false);
const formRef = ref();

const rules = {
  name: [{ required: true, message: 'Please enter a connection name', trigger: 'blur' }],
  host: [{ required: true, message: 'Please enter a host', trigger: 'blur' }],
  port: [{ required: true, message: 'Please enter a port', trigger: 'blur' }],
  username: [{ required: true, message: 'Please enter a username', trigger: 'blur' }],
  jdbc_url: [
    { 
      required: true, 
      message: 'Please enter a JDBC URL', 
      trigger: 'blur',
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (useJdbcUrl.value && !value) {
          callback(new Error('Please enter a JDBC URL'));
        } else if (useJdbcUrl.value && !value.startsWith('jdbc:mysql://')) {
          callback(new Error('JDBC URL must start with jdbc:mysql://'));
        } else {
          callback();
        }
      } 
    }
  ]
};

const emit = defineEmits(['connected']);

const connect = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid: boolean) => {
    console.error('Form validation resulForm validation resultt:', valid);
    if (!valid) {
      return;
    }
    if (!valid) return;
    
    isConnecting.value = true;
    
    try {
      const connectionConfig = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        password: formData.password,
        database: formData.database || undefined,
        schema: formData.schema || undefined
      };
      
      // Add JDBC URL if using that connection type
      if (useJdbcUrl.value && formData.jdbc_url) {
        (connectionConfig as any).jdbc_url = formData.jdbc_url;
      }
      
      console.log('Attempting to add connection with config:', connectionConfig);
      const connectionId = await dbStore.addConnection(connectionConfig);
      console.log('Connection ID received:', connectionId);
      
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
  formData.jdbc_url = 'jdbc:mysql://localhost:3306/table?autoReconnect=true';
  // useJdbcUrl.value = false;
};

watch(useJdbcUrl, (newValue) => {
  formData.connection_type = newValue ? 'jdbc' : 'standard';
});
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
    
    <el-form-item>
      <el-switch
        v-model="useJdbcUrl"
        active-text="Use JDBC URL"
        inactive-text="Standard Connection"

      />
    </el-form-item>
    
    <template v-if="useJdbcUrl">
      <el-form-item label="JDBC URL" prop="jdbc_url">
        <el-input 
          v-model="formData.jdbc_url" 
          placeholder="jdbc:mysql://hostname:port/database?params" 
        />
        <div class="form-help-text">Example: jdbc:mysql://localhost:3306/mydb?autoReconnect=true</div>
      </el-form-item>
    </template>
    
    <template v-else>
      <el-form-item label="Host" prop="host">
        <el-input v-model="formData.host" placeholder="localhost" />
      </el-form-item>
      
      <el-form-item label="Port" prop="port">
        <el-input-number v-model="formData.port" :min="1" :max="65535" />
      </el-form-item>
      
      <el-form-item label="Database" prop="database">
        <el-input v-model="formData.database" placeholder="Optional" />
      </el-form-item>
      <el-form-item label="Schema" prop="schema">
        <el-input v-model="formData.schema" placeholder="Optional" />
      </el-form-item>
    </template>
    
    <el-form-item label="Username" prop="username">
      <el-input v-model="formData.username" placeholder="root" />
    </el-form-item>
    
    <el-form-item label="Password" prop="password">
      <el-input v-model="formData.password" type="password" placeholder="Password" show-password />
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

.form-help-text {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>