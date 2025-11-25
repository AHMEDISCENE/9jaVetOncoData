import { callChatGPT } from './openaiClient';

const SCHEMA_DESCRIPTION = `Database schema for veterinary oncology analytics:

Table: cases
- id (uuid), case_number (text), clinic_id (uuid), created_by (uuid)
- species (text), breed (text), sex (text), age_years (int), age_months (int)
- patient_name (text)
- tumour_type_id (uuid), anatomical_site_id (uuid), stage (text), laterality (text)
- diagnosis_date (timestamp), diagnosis_method (text)
- treatment_regimen (text), treatment_start (timestamp), treatment_end (timestamp)
- treatment_plan (text), notes (text), outcome (text)
- state (text), geo_zone (text)
- created_at (timestamp), updated_at (timestamp)

Table: clinics
- id (uuid), name (text), state (text), city (text), lga (text)
- email (text), phone (text), address (text)

Whitelisted tables: cases, clinics

Common columns for filtering:
- cases.species, cases.state, cases.outcome, cases.stage
- cases.diagnosis_date, clinics.name, clinics.state`;

const SYSTEM_PROMPT = `You are a SQL query generator for veterinary oncology data analysis. 
Your task is to generate safe, read-only SQL SELECT queries based on natural language questions.

Rules:
1. Return ONLY ONE valid PostgreSQL SELECT statement
2. No comments, explanations, or additional text
3. Use the following schema: ${SCHEMA_DESCRIPTION}
4. Only use tables: cases, clinics (and joins between them)
5. Query must be read-only (SELECT only)
6. Limit results to 100 rows: append LIMIT 100 to every query
7. Always use explicit joins (INNER JOIN or LEFT JOIN)
8. Use aliases for tables to avoid ambiguity

Examples:
Question: "How many cases by species?"
Answer: SELECT species, COUNT(*) as count FROM cases GROUP BY species LIMIT 100

Question: "Show me all cases from Lagos"
Answer: SELECT c.case_number, c.patient_name, c.species, c.outcome FROM cases c LEFT JOIN clinics cl ON c.clinic_id = cl.id WHERE cl.state = 'Lagos' LIMIT 100`;

const DANGEROUS_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'EXEC', 'EXECUTE', '--', ';'];

export interface QueryResult {
  summary: string;
  columns: string[];
  rows: any[];
}

/**
 * Validate SQL query for safety
 */
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const cleanedSQL = sql.trim().toUpperCase();

  // Must start with SELECT
  if (!cleanedSQL.startsWith('SELECT')) {
    return { valid: false, error: 'Query must start with SELECT' };
  }

  // Check for dangerous keywords
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (cleanedSQL.includes(keyword)) {
      return { valid: false, error: `Query contains forbidden keyword: ${keyword}` };
    }
  }

  // Check for multiple statements (semicolon not at end)
  const semicolonCount = (sql.match(/;/g) || []).length;
  if (semicolonCount > 0) {
    return { valid: false, error: 'Multiple statements not allowed' };
  }

  // Only allow whitelisted tables
  const allowedTables = ['cases', 'clinics', 'tumour_types', 'anatomical_sites'];
  const tablePattern = /\b(FROM|JOIN)\s+(\w+)/gi;
  let match;
  const usedTables = new Set<string>();
  
  while ((match = tablePattern.exec(sql)) !== null) {
    const tableName = match[2].toLowerCase();
    if (!allowedTables.includes(tableName)) {
      return { valid: false, error: `Table not allowed: ${tableName}` };
    }
    usedTables.add(tableName);
  }

  return { valid: true };
}

/**
 * Generate SQL from natural language question and execute it
 */
export async function executeAnalyticsQuery(
  question: string,
  dbExecutor?: (sql: string) => Promise<any>,
  mode: "data_only" | "general" = "data_only"
): Promise<QueryResult> {
  try {
    // Generate SQL using ChatGPT
    const sqlQuery = await callChatGPT({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: question,
    });

    // Validate the SQL
    const validation = validateSQL(sqlQuery);
    if (!validation.valid) {
      return {
        summary: `I couldn't generate a safe query: ${validation.error}. Please rephrase your question more specifically.`,
        columns: [],
        rows: [],
      };
    }

    // Execute the query
    if (!dbExecutor) {
      throw new Error("Database executor is required");
    }
    const result = await dbExecutor(sqlQuery);

    if (!result || result.length === 0) {
      return {
        summary: 'No data found matching your query.',
        columns: [],
        rows: [],
      };
    }

    // Extract columns and rows
    const columns = Object.keys(result[0]);
    const rows = result.slice(0, 100); // Ensure we don't exceed 100 rows

    // Generate a summary using ChatGPT
    const sampleData = rows
      .slice(0, 3)
      .map(r => Object.entries(r).map(([k, v]) => `${k}=${v}`).join(', '))
      .join('\n');

    const summaryPrompt = `Based on this database query result, provide a brief 1-2 sentence summary in plain English:

Columns: ${columns.join(', ')}
Sample data (first 3 rows):
${sampleData}
Total rows returned: ${rows.length}

Summary should be concise and highlight key findings.`;

    const summary = await callChatGPT({
      userMessage: summaryPrompt,
      mode,
    });

    return {
      summary,
      columns,
      rows,
    };
  } catch (error) {
    console.error('[executeAnalyticsQuery] Error:', error);
    throw error;
  }
}
