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

CRITICAL RULES - DO NOT BREAK THESE:
1. ALWAYS start queries with SELECT
2. NEVER use: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, EXECUTE
3. Return ONLY ONE valid PostgreSQL SELECT statement
4. No comments, explanations, or additional text - ONLY the SQL query
5. Use the following schema: ${SCHEMA_DESCRIPTION}
6. Only use tables: cases, clinics (and joins between them)
7. Limit results to 100 rows: append LIMIT 100 to every query
8. Always use explicit joins (INNER JOIN or LEFT JOIN)
9. Use aliases for tables to avoid ambiguity
10. For date queries, use CURRENT_DATE and DATE functions

Examples:
Question: "How many cases by species?"
Answer: SELECT species, COUNT(*) as count FROM cases GROUP BY species LIMIT 100

Question: "Show me all cases from Lagos"
Answer: SELECT c.case_number, c.patient_name, c.species, c.outcome FROM cases c LEFT JOIN clinics cl ON c.clinic_id = cl.id WHERE cl.state = 'Lagos' LIMIT 100

Question: "How many cases was uploaded today?"
Answer: SELECT COUNT(*) as count FROM cases WHERE DATE(created_at) = CURRENT_DATE LIMIT 100

Question: "Cases by outcome this month"
Answer: SELECT outcome, COUNT(*) as count FROM cases WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) GROUP BY outcome LIMIT 100`;

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
 * Build a text summary of query results for context
 */
function buildQueryContext(columns: string[], rows: any[]): string {
  if (!rows || rows.length === 0) {
    return '';
  }

  const rowStrings = rows.map((row: any) => 
    Object.entries(row)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
  ).join('\n');

  return `VetOncoData Query Results:
Columns: ${columns.join(', ')}
Rows returned: ${rows.length}

Data:
${rowStrings}`;
}

/**
 * Get system prompt for strict mode analysis
 */
function getStrictModeSystemPrompt(): string {
  return `You are an analytics assistant for the VetOncoData veterinary cancer registry.

Your task: Base your answer ONLY on the data summary provided in the context from VetOncoData.
- Do NOT use general medical knowledge or facts outside the provided context.
- Always give as much descriptive analysis as possible:
  - counts and totals
  - percentages and proportions
  - comparisons between groups
  - simple trends over time if present
- If the context shows very limited data, still describe whatever is there.
- If the question is outside the scope of VetOncoData (e.g., asking about another country or non-veterinary topics), 
  say that Strict VetOncoData mode can only answer questions about the cases in the database.

Remember: Only analyze the data provided. Never add information from outside sources.`;
}

/**
 * Generate SQL from natural language question and execute it
 */
export async function executeAnalyticsQuery(
  question: string,
  dbExecutor?: (sql: string) => Promise<any>,
  mode: "strict" | "universal" = "strict"
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
      // In universal mode, provide general knowledge when SQL generation fails
      if (mode === "universal") {
        const generalKnowledgePrompt = `Your VetOncoData database couldn't generate a query for: "${question}"

Please provide general information about this topic from your veterinary/oncology knowledge. Keep your response brief (1-2 sentences) and informative. Remind users this general knowledge is not a substitute for professional veterinary advice.`;

        const summary = await callChatGPT({
          userMessage: generalKnowledgePrompt,
          mode,
        });

        return {
          summary,
          columns: [],
          rows: [],
        };
      }

      // In strict mode, return a clear message that this question cannot be answered
      return {
        summary: 'In Strict VetOncoData mode, I can only answer questions about the cases stored in your database. For this question I could not generate a valid query. Try adjusting your question or switch to Universal Oncology AI mode.',
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
      // In universal mode, provide general knowledge when no data is found
      if (mode === "universal") {
        const generalKnowledgePrompt = `Your VetOncoData database has no cases matching the query: "${question}"

Please provide general information about this topic from your veterinary/oncology knowledge. Keep your response brief (1-2 sentences) and informative. Remind users this general knowledge is not a substitute for professional veterinary advice.`;

        const summary = await callChatGPT({
          userMessage: generalKnowledgePrompt,
          mode,
        });

        return {
          summary,
          columns: [],
          rows: [],
        };
      }

      // In strict mode, return a clear message without calling ChatGPT
      return {
        summary: 'In Strict VetOncoData mode, I can only answer questions about the cases stored in your database. For this question I could not find any relevant data. Try adjusting your question or switch to Universal Oncology AI mode.',
        columns: [],
        rows: [],
      };
    }

    // Extract columns and rows
    const columns = Object.keys(result[0]);
    const rows = result.slice(0, 100); // Ensure we don't exceed 100 rows

    // Build context from query results
    const context = buildQueryContext(columns, rows);

    // Choose system prompt based on mode
    const systemPrompt = mode === "strict" ? getStrictModeSystemPrompt() : undefined;

    const summaryPrompt = `Analyze this VetOncoData query result for the question: "${question}"

Provide a descriptive analysis highlighting key findings, counts, percentages, and any patterns in the data.`;

    const summary = await callChatGPT({
      systemPrompt,
      userMessage: summaryPrompt,
      context,
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
