export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  schema?: string;
  jdbc_url?: string;
  create_time?: number;
  touch_time?: number;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  affected_rows: number;
}

export interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface AppConfig {
  theme: string;
  font_size: number;
  show_line_numbers: boolean;
  max_rows_display: number;
  saved_connections: ConnectionConfig[];
  window_state?: WindowState;
}