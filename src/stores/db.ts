import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  schema?: string;
  jdbc_url?: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  affected_rows: number;
}

interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const useDbStore = defineStore('db', {
  state: () => ({
    connections: [] as ConnectionConfig[],
    activeConnectionId: null as string | null,
    databases: [] as string[],
    tables: [] as string[],
    selectedDatabase: null as string | null,
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
        const response = await invoke<CommandResponse<any>>('get_app_config');
        
        if (response.success && response.data && response.data.saved_connections) {
          // Store connections in memory but don't connect to them
          this.connections = response.data.saved_connections;
          // Don't set any connection as active on startup
          this.activeConnectionId = null;
        }
        
        this.initialized = true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      }
    },
    
    async saveConnectionsToConfig() {
      try {
        const response = await invoke<CommandResponse<any>>('get_app_config');
        
        if (response.success && response.data) {
          const config = response.data;
          config.saved_connections = this.connections;
          
          await invoke<CommandResponse<void>>('save_app_config', { config });
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
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
        const connectionId = await invoke<string>('connect_to_database', { 
          config: {
            ...connectionConfig,
            schema: connectionConfig.schema || null
          } 
        });
        
        // Add to connections list if not already present
        if (!this.connections.some(conn => conn.id === connectionConfig.id)) {
          this.connections.push(connectionConfig);
          await this.saveConnectionsToConfig();
        }
        
        // Set as active and load databases
        this.activeConnectionId = connectionConfig.id;
        
        // If a schema is specified, select it after loading databases
        if (connectionConfig.schema) {
          await this.loadDatabases();
          await this.selectDatabase(connectionConfig.schema);
        } else {
          await this.loadDatabases();
        }
        
        return connectionId;
        
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
    
    async loadDatabases() {
      if (!this.activeConnectionId) return;
      
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await invoke<CommandResponse<string[]>>('list_databases', { 
          connId: this.activeConnectionId 
        });
        
        if (response.success && response.data) {
          this.databases = response.data;
        } else {
          this.error = response.error || 'Failed to load databases';
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.isLoading = false;
      }
    },
    
    async selectDatabase(database: string) {
      if (!this.activeConnectionId) return;
      
      this.isLoading = true;
      this.error = null;
      this.selectedDatabase = database;
      this.selectedTable = null;
      this.tableData = null;
      
      try {
        const response = await invoke<CommandResponse<string[]>>('list_tables', { 
          connId: this.activeConnectionId,
          database
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
      if (!this.activeConnectionId || !this.selectedDatabase) return;
      
      this.isLoading = true;
      this.error = null;
      this.selectedTable = table;
      
      try {
        const response = await invoke<CommandResponse<QueryResult>>('get_table_data', { 
          connId: this.activeConnectionId,
          database: this.selectedDatabase,
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
          this.databases = [];
          this.tables = [];
          this.selectedDatabase = null;
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
        
        // Then update the active connection and load databases
        this.activeConnectionId = connectionId;
        this.databases = [];
        this.tables = [];
        this.selectedDatabase = null;
        this.selectedTable = null;
        this.tableData = null;
        
        // If a schema is specified, select it after loading databases
        if (connection.schema) {
          await this.loadDatabases();
          await this.selectDatabase(connection.schema);
        } else {
          await this.loadDatabases();
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
        this.databases = [];
        this.tables = [];
        this.selectedDatabase = null;
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