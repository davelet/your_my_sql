/**
 * SQL utility functions for formatting and manipulating SQL queries
 */

/**
 * Formats an SQL query for better readability
 * @param query The SQL query string to format
 * @returns The formatted SQL query
 */
export function formatSqlQuery(query: string): string {
  return query
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
}

/**
 * Checks if a SQL query has a LIMIT clause
 * @param query The SQL query to check
 * @returns True if the query has a LIMIT clause, false otherwise
 */
export function hasLimitClause(query: string): boolean {
  if (!query) return false;
  
  // Remove comments and normalize whitespace
  const normalizedQuery = query
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase(); // Convert to uppercase for case-insensitive matching
  
  // First try a simple check for the word LIMIT
  const hasLimitWord = normalizedQuery.includes('LIMIT');
  
  if (!hasLimitWord) {
    return false;
  }
  
  // Use a more robust regex to detect LIMIT clauses
  // This pattern looks for the word LIMIT followed by a number
  // We're using a more permissive pattern that allows for various whitespace and formatting
  const limitRegex = /\bLIMIT\s+\d+/i;
  const hasLimit = limitRegex.test(normalizedQuery);
  
  return hasLimit;
}

/**
 * Adds a LIMIT clause to a SQL query if it doesn't already have one
 * @param query The SQL query to modify
 * @param maxRows The maximum number of rows to limit to
 * @returns The SQL query with a LIMIT clause added if needed
 */
export function addLimitToQuery(query: string, maxRows: number): string {
  if (!query || !maxRows || maxRows <= 0) {
    return query;
  }
  
  // Normalize the query for checking
  const trimmedQuery = query.trim();
  const upperQuery = trimmedQuery.toUpperCase();
  
  // Only add LIMIT to SELECT queries
  if (!upperQuery.startsWith('SELECT')) {
    return query;
  }
  
  // Check if the query already has a LIMIT clause
  if (hasLimitClause(query)) {
    return query;
  }
  
  // Add the LIMIT clause
  const endsWithSemicolon = trimmedQuery.endsWith(';');
  
  let result;
  if (endsWithSemicolon) {
    result = trimmedQuery.slice(0, -1) + ` LIMIT ${maxRows};`;
  } else {
    result = trimmedQuery + ` LIMIT ${maxRows}`;
  }
  
  return result;
}