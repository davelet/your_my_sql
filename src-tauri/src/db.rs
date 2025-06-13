use mysql::{prelude::*, Opts, OptsBuilder, Pool, PooledConn, Row, Value};  
use r2d2::PooledConnection;
use r2d2_mysql::mysql::Conn;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use thiserror::Error;

// Re-export the CONNECTION_MANAGER for use in other modules
pub use lazy_static::lazy_static;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Connection error: {0}")]
    ConnectionError(String),
    
    #[error("Query error: {0}")]
    QueryError(String),
    
    #[error("Pool error: {0}")]
    PoolError(String),
    
    #[error("No connection found with id: {0}")]
    NoConnection(String),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionConfig {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub affected_rows: u64,
}

// Global connection pool manager
pub struct ConnectionManager {
    connections: HashMap<String, Pool>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        ConnectionManager {
            connections: HashMap::new(),
        }
    }
    
    pub fn create_connection(&mut self, config: ConnectionConfig) -> Result<(), DbError> {
        let opts = OptsBuilder::new()
            .ip_or_hostname(Some(config.host))
            .tcp_port(config.port)
            .user(Some(config.username))
            .pass(Some(config.password));
            
        let opts = if let Some(db) = &config.database {
            opts.db_name(Some(db))
        } else {
            opts
        };
        
        let pool = Pool::new(opts)
            .map_err(|e| DbError::ConnectionError(e.to_string()))?;
            
        // Test connection
        let _conn = pool.get_conn()
            .map_err(|e| DbError::ConnectionError(e.to_string()))?;
            
        self.connections.insert(config.id.clone(), pool);
        Ok(())
    }
    
    pub fn get_connection(&self, id: &str) -> Result<PooledConn, DbError> {
        let pool = self.connections.get(id)
            .ok_or_else(|| DbError::NoConnection(id.to_string()))?;
            
        pool.get_conn()
            .map_err(|e| DbError::ConnectionError(e.to_string()))
    }
    
    pub fn execute_query(&self, conn_id: &str, query: &str) -> Result<QueryResult, DbError> {
        let mut conn = self.get_connection(conn_id)?;
        
        // For SELECT queries
        if query.trim().to_lowercase().starts_with("select") {
            let result = conn.query_iter(query)
                .map_err(|e| DbError::QueryError(e.to_string()))?;
                
            let mut columns = Vec::new();
            let column_defs = result.columns();
            
            for column in column_defs.as_ref() {
                columns.push(column.name_str().to_string());
            }
            
            let mut rows = Vec::new();
            for row_result in result {
                let row = row_result.map_err(|e| DbError::QueryError(e.to_string()))?;
                let mut row_map = HashMap::new();
                
                for (i, column_name) in columns.iter().enumerate() {
                    let value = mysql_value_to_json(&row[i]);
                    row_map.insert(column_name.clone(), value);
                }
                
                rows.push(row_map);
            }
            
            Ok(QueryResult {
                columns,
                rows,
                affected_rows: 0,
            })
        } else {
            // For non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
            let result = conn.query_drop(query)
                .map_err(|e| DbError::QueryError(e.to_string()))?;
                
            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                affected_rows: conn.affected_rows(),
            })
        }
    }
    
    pub fn list_databases(&self, conn_id: &str) -> Result<Vec<String>, DbError> {
        let mut conn = self.get_connection(conn_id)?;
        let query = "SHOW DATABASES";
        
        let result: Vec<String> = conn.query(query)
            .map_err(|e| DbError::QueryError(e.to_string()))?;
            
        Ok(result)
    }
    
    pub fn list_tables(&self, conn_id: &str, database: &str) -> Result<Vec<String>, DbError> {
        let mut conn = self.get_connection(conn_id)?;
        
        // First select the database
        let use_db = format!("USE {}", database);
        conn.query_drop(&use_db)
            .map_err(|e| DbError::QueryError(e.to_string()))?;
            
        let query = "SHOW TABLES";
        let result: Vec<String> = conn.query(query)
            .map_err(|e| DbError::QueryError(e.to_string()))?;
            
        Ok(result)
    }
    
    pub fn get_table_data(&self, conn_id: &str, database: &str, table: &str, limit: usize) 
        -> Result<QueryResult, DbError> {
        let mut conn = self.get_connection(conn_id)?;
        
        // First select the database
        let use_db = format!("USE {}", database);
        conn.query_drop(&use_db)
            .map_err(|e| DbError::QueryError(e.to_string()))?;
            
        let query = format!("SELECT * FROM {} LIMIT {}", table, limit);
        self.execute_query(conn_id, &query)
    }
    
    pub fn close_connection(&mut self, id: &str) -> Result<(), DbError> {
        if self.connections.remove(id).is_none() {
            return Err(DbError::NoConnection(id.to_string()));
        }
        Ok(())
    }
}

// Helper function to convert MySQL values to JSON values
fn mysql_value_to_json(value: &Value) -> serde_json::Value {
    match value {
        Value::NULL => serde_json::Value::Null,
        Value::Bytes(bytes) => {
            // Try to convert bytes to string if possible
            match std::str::from_utf8(bytes) {
                Ok(s) => serde_json::Value::String(s.to_string()),
                Err(_) => serde_json::Value::String(format!("<binary data: {} bytes>", bytes.len())),
            }
        },
        Value::Int(i) => serde_json::Value::Number((*i).into()),
        Value::UInt(i) => {
            // Convert u64 to i64 if possible, otherwise to string
            if *i <= i64::MAX as u64 {
                serde_json::Value::Number((*i as i64).into())
            } else {
                serde_json::Value::String(i.to_string())
            }
        },
        Value::Float(f) => {
            // Convert f32 to serde_json::Number
            match serde_json::Number::from_f64(*f as f64) {
                Some(n) => serde_json::Value::Number(n),
                None => serde_json::Value::String(f.to_string()),
            }
        },
        Value::Double(d) => {
            // Convert f64 to serde_json::Number
            match serde_json::Number::from_f64(*d) {
                Some(n) => serde_json::Value::Number(n),
                None => serde_json::Value::String(d.to_string()),
            }
        },
        Value::Date(year, month, day, hour, min, sec, _micro) => {
            serde_json::Value::String(format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", 
                                              year, month, day, hour, min, sec))
        },
        Value::Time(neg, _days, hours, minutes, seconds, micros) => {
            let sign = if *neg { "-" } else { "" };
            serde_json::Value::String(format!("{}{:02}:{:02}:{:02}.{:06}", 
                                              sign, hours, minutes, seconds, micros))
        }
    }
}

// Lazy static for global connection manager
lazy_static::lazy_static! {
    pub static ref CONNECTION_MANAGER: Arc<Mutex<ConnectionManager>> = {
        Arc::new(Mutex::new(ConnectionManager::new()))
    };
}