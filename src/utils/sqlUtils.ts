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