import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';

interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
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
  }),

  actions: {
    async addConnection(config: Omit<ConnectionConfig, 'id'>) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const connectionConfig = {
          ...config,
          id: uuidv4(),
          port: Number(config.port) || 3306
        };
        
        const connectionId = await invoke<string>('connect_to_database', { config: connectionConfig });
        
        this.connections.push(connectionConfig);
        this.activeConnectionId = connectionConfig.id;
        await this.loadDatabases();
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
        
        // Remove from local state
        this.connections = this.connections.filter(conn => conn.id !== connId);
        
        if (this.activeConnectionId === connId) {
          this.activeConnectionId = this.connections.length > 0 ? this.connections[0].id : null;
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
    
    setActiveConnection(connectionId: string) {
      this.activeConnectionId = connectionId;
      this.databases = [];
      this.tables = [];
      this.selectedDatabase = null;
      this.selectedTable = null;
      this.tableData = null;
      this.loadDatabases();
    },
    
    clearQueryResult() {
      this.queryResult = null;
    }
  }
});