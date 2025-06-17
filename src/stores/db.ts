import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { ElMessage } from 'element-plus';
import type { ConnectionConfig, QueryResult, CommandResponse, AppConfig, WindowState } from './db.types';

export const useDbStore = defineStore('db', {
  state: () => ({
    connections: [] as ConnectionConfig[],
    activeConnectionId: null as string | null,
    schemas: [] as string[],
    tables: [] as string[],
    selectedSchema: null as string | null,
    selectedTable: null as string | null,
    tableData: null as QueryResult | null,
    queryResult: null as QueryResult | null,
    isLoading: false,
    error: null as string | null,
    initialized: false,
  }),
  actions: {
    async initialize() {
      if (this.initialized) return;
      
      try {
        const response = await invoke<CommandResponse<AppConfig>>('get_app_config');
        
        if (response.success && response.data) {
          if (response.data.saved_connections) {
            this.connections = response.data.saved_connections;
          }
          this.activeConnectionId = null;
        } else {
          this.error = response.error || 'Failed to initialize: could not get app config';
          console.error('Initialization failed:', this.error);
        }
        
        this.initialized = true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        console.error('Error during initialization:', this.error);
      }
    },
    
    async saveConnectionsToConfig(): Promise<boolean> {
      try {
        const getConfigResponse = await invoke<CommandResponse<AppConfig>>('get_app_config');
        
        if (getConfigResponse.success && getConfigResponse.data) {
          const config = getConfigResponse.data;
          config.saved_connections = [...this.connections]; // Use spread for new array
          
          const saveConfigResponse = await invoke<CommandResponse<void>>('save_app_config', { config });
          if (!saveConfigResponse.success) {
            this.error = saveConfigResponse.error || 'Failed to save app config (unknown error)';
            console.error("Failed to save app config:", this.error);
            return false;
          }
          return true;
        } else {
          this.error = getConfigResponse.error || 'Failed to get app config during save (unknown error)';
          console.error("Failed to get app config during save:", this.error);
          return false;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        console.error("Error in saveConnectionsToConfig:", this.error);
        return false;
      }
    },
    async addConnection(config: Omit<ConnectionConfig, 'id'>, closeExisting = true) {
      this.isLoading = true;
      this.error = null;
      
      try {
        // Close existing connection if requested
        if (closeExisting && this.activeConnectionId) {
          try {
            await this.closeConnection(this.activeConnectionId);
          } catch (error) {
            console.warn('Failed to close existing connection:', error);
            // Continue with new connection even if closing old one fails
          }
        }

        // Create connection config with ID and proper types
        const connectionConfig: ConnectionConfig = {
          ...config,
          id: uuidv4(),
          port: Number(config.port) || 3306,
          schema: config.schema || undefined
        };
        
        // Connect to the database
        const updatedConfig = await invoke<ConnectionConfig>('connect_to_database', { 
          config: {
            ...connectionConfig,
            schema: connectionConfig.schema || null
          } 
        });
        updatedConfig.name = config.name;
        
        // Add to connections list if not already present
        if (!this.connections.some(conn => conn.id === updatedConfig.id)) {
          // Use the updated config returned from the backend
          // This will have the parsed host, port, and schema if a JDBC URL was used
          // and the jdbc_url field will be removed
          this.connections.push(updatedConfig);
          const savedSuccessfully = await this.saveConnectionsToConfig();
          if (!savedSuccessfully) {
            // Error is already set in dbStore.error by saveConnectionsToConfig
            ElMessage.error(`Connection successful, but failed to save configuration: ${this.error}`);
            // Optionally, you might want to revert adding the connection if saving is critical
            // For now, we'll leave it in memory but flag the save error.
          }
        }
        
        // Set as active and load databases
        this.activeConnectionId = updatedConfig.id;
        
        // If a schema is specified, select it after loading databases
        if (updatedConfig.schema) {
          await this.loadSchemas();
          await this.selectSchema(updatedConfig.schema);
        } else {
          await this.loadSchemas();
        }
        
        return updatedConfig.id;
        
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
    
    async loadSchemas() {
      if (!this.activeConnectionId) return;
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await invoke<CommandResponse<string[]>>('list_databases', { 
          connId: this.activeConnectionId 
        });
        
        if (response.success && response.data) {
          this.schemas = response.data;
        } else {
          this.error = response.error || 'Failed to load schemas';
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.isLoading = false;
      }
    },
    
    async selectSchema(schema: string) {
      if (!this.activeConnectionId) return;
      
      this.isLoading = true;
      this.error = null;
      this.selectedSchema = schema;
      this.selectedTable = null;
      this.tableData = null;
      
      try {
        const response = await invoke<CommandResponse<string[]>>('list_tables', { 
          connId: this.activeConnectionId,
          schema
        });
        
        if (response.success && response.data) {
          this.tables = response.data;
        } else {
          this.error = response.error || 'Failed to load tables';
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.isLoading = false;
      }
    },
    
    async selectTable(table: string, limit: number = 100) {
      if (!this.activeConnectionId || !this.selectedSchema) return;
      
      this.isLoading = true;
      this.error = null;
      this.selectedTable = table;
      
      try {
        const response = await invoke<CommandResponse<QueryResult>>('get_table_data', { 
          connId: this.activeConnectionId,
          schema: this.selectedSchema,
          table,
          limit
        });
        
        if (response.success && response.data) {
          this.tableData = response.data;
        } else {
          this.error = response.error || 'Failed to load table data';
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.isLoading = false;
      }
    },
    
    async executeQuery(query: string) {
      if (!this.activeConnectionId) return;
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await invoke<CommandResponse<QueryResult>>('execute_query', { 
          connId: this.activeConnectionId,
          query
        });
        
        if (response.success && response.data) {
          this.queryResult = response.data;
          return response.data;
        } else {
          this.error = response.error || 'Failed to execute query';
          return null;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
    
    async closeConnection(connectionId?: string) {
      const connId = connectionId || this.activeConnectionId;
      if (!connId) return;
      
      this.isLoading = true;
      
      try {
        await invoke<CommandResponse<void>>('close_connection', { connId });
        
        // Clear active connection state
        if (this.activeConnectionId === connId) {
          this.activeConnectionId = null;
          this.schemas = [];
          this.tables = [];
          this.selectedSchema = null;
          this.selectedTable = null;
          this.tableData = null;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.isLoading = false;
      }
    },
    
    async setActiveConnection(connectionId: string) {
      const connection = this.connections.find(conn => conn.id === connectionId);
      if (!connection) return;
      
      this.isLoading = true;
      this.error = null;
      
      try {
        // First, establish the connection with the backend
        await invoke('connect_to_database', { 
          config: {
            ...connection,
            port: Number(connection.port) || 3306,
            // Include schema in the connection config if specified
            schema: connection.schema || null
          } 
        });
        
        // Then update the active connection and load schemas
        this.activeConnectionId = connectionId;
        this.schemas = [];
        this.tables = [];
        this.selectedSchema = null;
        this.selectedTable = null;
        this.tableData = null;
        
        // If a schema is specified, select it after loading schemas
        if (connection.schema) {
          await this.loadSchemas();
          await this.selectSchema(connection.schema);
        } else {
          await this.loadSchemas();
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        throw error; // Re-throw so the UI can show an error message
      } finally {
        this.isLoading = false;
      }
    },
    
    async closeAllConnections() {
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await invoke<CommandResponse<void>>('close_all_connections');
        
        if (!response.success) {
          this.error = response.error || 'Failed to close all connections';
          return false;
        }
        
        // Reset all connection state
        this.activeConnectionId = null;
        this.schemas = [];
        this.tables = [];
        this.selectedSchema = null;
        this.selectedTable = null;
        this.tableData = null;
        this.queryResult = null;
        
        return true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    
    clearQueryResult() {
      this.queryResult = null;
    }
  }
});