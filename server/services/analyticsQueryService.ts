import { callChatGPT } from './openaiClient';

// Comprehensive schema description for AI analytics
const AI_ANALYTICS_SCHEMA_DESCRIPTION = `VetOncoData Database Schema for Analytics

TABLE: cases
Core veterinary oncology case records.
Columns:
  - id (uuid): Unique case identifier
  - case_number (text): Human-readable case reference
  - clinic_id (uuid): Reference to the clinic that owns this case
  - created_at (timestamp): When case was uploaded/created. USE THIS for "uploaded today/this month/this year"
  - updated_at (timestamp): Last modified timestamp
  - created_by (uuid): User ID of who created the case
  
Patient Information:
  - patient_name (text): Name of the patient (animal)
  - species (text): Species (e.g. "Canine", "Feline", "Avian")
  - breed (text): Breed name
  - sex (text enum): MALE_NEUTERED, MALE_INTACT, FEMALE_SPAYED, FEMALE_INTACT
  - age_years (integer): Age in years
  - age_months (integer): Age in months component
  
Location:
  - state (state enum): Nigerian state (e.g. LAGOS, FCT, ENUGU, etc)
  - geo_zone (geopolitical_zone enum): NORTH_CENTRAL, NORTH_EAST, NORTH_WEST, SOUTH_EAST, SOUTH_SOUTH, SOUTH_WEST
  
Tumour Details:
  - tumour_type_id (uuid): Reference to tumour_types table
  - tumour_type_custom (text): Custom tumour type if not in predefined list
  - anatomical_site_id (uuid): Reference to anatomical_sites table
  - anatomical_site_custom (text): Custom anatomical site if not in predefined list
  - laterality (text): left, right, bilateral, central, etc.
  - stage (text): Tumour stage/grade
  
Diagnosis & Treatment:
  - diagnosis_date (timestamp): Date of diagnosis
  - diagnosis_method (text): How diagnosed (biopsy, imaging, etc)
  - treatment_plan (text): Treatment plan details
  - treatment_start (timestamp): When treatment started
  
Outcome:
  - outcome (outcome enum): REMISSION, MORTALITY, EUTHANASIA, TREATMENT_ONGOING, MANAGEMENT
  - last_follow_up (timestamp): Date of last follow-up
  - notes (text): Additional clinical notes
  
Status:
  - status (status enum): DRAFT, ACTIVE, COMPLETED, ARCHIVED
  
TABLE: clinics
Veterinary clinic information.
Columns:
  - id (uuid): Unique clinic identifier
  - name (text): Clinic name
  - state (state enum): Nigerian state where clinic operates
  - city (text): City name
  - lga (text): Local Government Area
  - email (text): Contact email
  - phone (text): Contact phone
  - address (text): Full address
  - created_at (timestamp): When clinic was registered
  - updated_at (timestamp): Last updated

TABLE: tumour_types (reference table)
Predefined tumour types.
Columns:
  - id (uuid)
  - name (text): Tumour type name
  - species (text): Optional species filter
  - is_system (boolean): True if system-defined

TABLE: anatomical_sites (reference table)
Predefined anatomical sites.
Columns:
  - id (uuid)
  - name (text): Site name
  - species (text): Optional species filter
  - is_system (boolean): True if system-defined

IMPORTANT NOTES:
- "Uploaded today" refers to cases.created_at = CURRENT_DATE
- "This month" means DATE_TRUNC('month', cases.created_at) = DATE_TRUNC('month', CURRENT_DATE)
- "This year" means EXTRACT(YEAR FROM cases.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
- Use JOIN with clinics table to get clinic name/state in results
- Nigerian states: ABIA, ADAMAWA, AKWA_IBOM, ANAMBRA, BAUCHI, BAYELSA, BENUE, BORNO, CROSS_RIVER, DELTA, EBONYI, EDO, EKITI, ENUGU, FCT, GOMBE, IMO, JIGAWA, KADUNA, KANO, KATSINA, KEBBI, KOGI, KWARA, LAGOS, NASARAWA, NIGER, OGUN, ONDO, OSUN, OYO, PLATEAU, RIVERS, SOKOTO, TARABA, YOBE, ZAMFARA
- Outcome values: REMISSION, MORTALITY, EUTHANASIA, TREATMENT_ONGOING, MANAGEMENT`;

const SQL_GENERATION_SYSTEM_PROMPT = `You are an expert SQL query generator for the VetOncoData veterinary oncology registry database.

Your task: Generate ONE valid PostgreSQL SELECT query that answers the user's question.

Schema Information:
${AI_ANALYTICS_SCHEMA_DESCRIPTION}

CRITICAL RULES:
1. ONLY output a valid PostgreSQL SELECT statement - NO explanations, comments, or extra text
2. ALWAYS use LIMIT 100 to prevent too many results
3. Use table aliases (e.g., 'c' for cases, 'cl' for clinics) for clarity
4. Always use explicit JOIN syntax (JOIN...ON) when combining tables
5. For date filtering - VERY IMPORTANT:
   - TODAY: WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
   - THIS MONTH: WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
   - THIS YEAR: WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
   - YEAR RANGE (e.g. "2021-2025"): WHERE created_at >= '2021-01-01' AND created_at < '2026-01-01'
   - DATE RANGE: WHERE created_at >= 'START_DATE' AND created_at <= 'END_DATE'
6. Include relevant clinic information when useful (clinic name, state, etc)
7. Use COUNT(*) for counts, GROUP BY for aggregations
8. Only reference tables and columns that actually exist in the schema
9. Make queries readable with proper formatting
10. ALLOWED OPERATORS: WHERE, AND, OR, BETWEEN, JOIN, GROUP BY, ORDER BY, HAVING, COUNT, SUM, AVG, MAX, MIN, EXTRACT, DATE_TRUNC

Example Queries:
Q: "How many cases were uploaded today?"
A: SELECT COUNT(*) as total_cases FROM cases WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'

Q: "Number of cases from 2021 - 2025"
A: SELECT COUNT(*) as total_cases FROM cases WHERE created_at >= '2021-01-01' AND created_at < '2026-01-01'

Q: "How many feline cases from Lagos this year?"
A: SELECT COUNT(*) as feline_count FROM cases c JOIN clinics cl ON c.clinic_id = cl.id WHERE c.species = 'Feline' AND cl.state = 'LAGOS' AND EXTRACT(YEAR FROM c.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)

Q: "Cases by species breakdown"
A: SELECT species, COUNT(*) as count FROM cases GROUP BY species ORDER BY count DESC LIMIT 100

Q: "Which clinic has the highest number of remission cases?"
A: SELECT cl.name, COUNT(*) as remission_count FROM cases c JOIN clinics cl ON c.clinic_id = cl.id WHERE c.outcome = 'REMISSION' GROUP BY cl.id, cl.name ORDER BY remission_count DESC LIMIT 100`;

// Dangerous SQL keywords (matched as whole words only, not substrings)
const DANGEROUS_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'EXEC', 'EXECUTE'];
// SQL comments are checked separately
const COMMENT_PATTERNS = ['--', '/*', '*/'];

/**
 * Try to parse a simple date-range question like "number of cases from 2021-2025"
 * Returns a safe SQL query if pattern matches, otherwise null
 */
function trySimpleDateRangeFallback(question: string): string | null {
  const question_lower = question.toLowerCase();
  
  // Pattern 1: "number of cases from YEAR1 - YEAR2" or "cases from YEAR1-YEAR2"
  const yearRangeMatch = question_lower.match(/(?:number of )cases from (\d{4})\s*[-–to]+\s*(\d{4})/i);
  if (yearRangeMatch) {
    const year1 = parseInt(yearRangeMatch[1]);
    const year2 = parseInt(yearRangeMatch[2]);
    const startYear = Math.min(year1, year2);
    const endYear = Math.max(year1, year2);
    return `SELECT COUNT(*) as total_cases FROM cases WHERE created_at >= '${startYear}-01-01' AND created_at < '${endYear + 1}-01-01'`;
  }

  // Pattern 2: "cases from YEAR1 to YEAR2"
  const yearToMatch = question_lower.match(/cases from (\d{4}) to (\d{4})/i);
  if (yearToMatch) {
    const year1 = parseInt(yearToMatch[1]);
    const year2 = parseInt(yearToMatch[2]);
    const startYear = Math.min(year1, year2);
    const endYear = Math.max(year1, year2);
    return `SELECT COUNT(*) as total_cases FROM cases WHERE created_at >= '${startYear}-01-01' AND created_at < '${endYear + 1}-01-01'`;
  }

  // Pattern 3: "uploaded this month/year/today"
  if (question_lower.includes('uploaded') && question_lower.includes('today')) {
    return `SELECT COUNT(*) as total_cases FROM cases WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`;
  }
  if (question_lower.includes('uploaded') && question_lower.includes('month')) {
    return `SELECT COUNT(*) as total_cases FROM cases WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`;
  }
  if (question_lower.includes('uploaded') && question_lower.includes('year')) {
    return `SELECT COUNT(*) as total_cases FROM cases WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`;
  }

  return null;
}

export interface CaseReference {
  id: string;
  case_number?: string;
  patient_name?: string;
  clinic_name?: string;
}

export interface QueryResult {
  summary: string;
  columns: string[];
  rows: any[];
  caseReferences?: CaseReference[];
  reportUrl?: string;
}

/**
 * Validate SQL query for safety
 * Uses proper word boundary checking to avoid false positives (e.g., CURRENT_DATE contains CREATE)
 */
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmedSQL = sql.trim();
  const cleanedSQL = trimmedSQL.toUpperCase();

  // Must start with SELECT
  if (!cleanedSQL.startsWith('SELECT')) {
    return { valid: false, error: 'Query must start with SELECT' };
  }

  // Check for SQL comments
  for (const comment of COMMENT_PATTERNS) {
    if (cleanedSQL.includes(comment)) {
      return { valid: false, error: 'SQL comments are not allowed' };
    }
  }

  // Check for dangerous keywords using word boundaries (not substring match)
  for (const keyword of DANGEROUS_KEYWORDS) {
    // Use word boundary regex to match only complete keywords
    const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'gi');
    if (keywordRegex.test(cleanedSQL)) {
      return { valid: false, error: `Query contains forbidden keyword: ${keyword}` };
    }
  }

  // Check for multiple statements (multiple semicolons or statements)
  // Allow a trailing semicolon but nothing after it
  const trimmedEnd = trimmedSQL.trimEnd();
  if (trimmedEnd.endsWith(';')) {
    const beforeSemicolon = trimmedEnd.slice(0, -1);
    if (beforeSemicolon.includes(';')) {
      return { valid: false, error: 'Multiple SQL statements not allowed' };
    }
  } else if (trimmedSQL.includes(';')) {
    return { valid: false, error: 'SQL statements must end with SELECT...LIMIT 100 (no semicolon)' };
  }

  // Only allow whitelisted tables
  const allowedTables = ['cases', 'clinics', 'tumour_types', 'anatomical_sites', 'ng_states'];
  
  // Check that only allowed tables are used
  // Pattern matches: FROM|JOIN <tablename> [alias|AS alias]
  const tablePattern = /\b(FROM|JOIN|INTO)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?\b/gi;
  let match;
  const usedTables = new Set<string>();
  
  while ((match = tablePattern.exec(trimmedSQL)) !== null) {
    const actualTableName = match[2].toLowerCase();
    if (!allowedTables.includes(actualTableName)) {
      return { valid: false, error: `Table not allowed: ${actualTableName}` };
    }
    usedTables.add(actualTableName);
  }

  return { valid: true };
}

/**
 * Extract case references from query results for clickable links
 */
function extractCaseReferences(rows: any[]): CaseReference[] {
  const caseRefs: CaseReference[] = [];
  
  for (const row of rows) {
    if (row.id && (row.case_number || row.patient_name)) {
      caseRefs.push({
        id: row.id,
        case_number: row.case_number || undefined,
        patient_name: row.patient_name || undefined,
        clinic_name: row.clinic_name || undefined,
      });
    }
  }
  
  return caseRefs;
}

/**
 * Build a text context from query results for ChatGPT analysis
 */
function buildQueryContextForAnalysis(columns: string[], rows: any[]): string {
  if (!rows || rows.length === 0) {
    return 'No data was found.';
  }

  const header = `VetOncoData Query Results:
Columns: ${columns.join(', ')}
Total rows: ${rows.length}\n`;

  // Format rows for readability
  const rowTexts = rows.map((row: any) => {
    const entries = Object.entries(row)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return `  ${entries}`;
  }).join('\n');

  return `${header}Data:\n${rowTexts}`;
}

/**
 * Get system prompt for strict mode analysis
 */
function getStrictModeSystemPrompt(): string {
  return `You are an analytics assistant for the VetOncoData veterinary cancer registry.

Your task: Base your answer ONLY on the data provided in the query results context.
CRITICAL: Do NOT use general medical knowledge or any facts outside the provided data.

Guidelines:
- Provide descriptive analysis of the data including:
  - Key counts and totals
  - Percentages and proportions (calculate if needed)
  - Comparisons between groups in the data
  - Simple trends if visible in the data
- If data is limited, still describe what's there
- If the question is outside VetOncoData scope, say "In Strict VetOncoData mode, I can only answer questions about the cases in your database"

Never add information not in the provided data.`;
}

/**
 * Get system prompt for universal mode analysis
 */
function getUniversalModeSystemPrompt(): string {
  return `You are an analytics assistant for the VetOncoData veterinary cancer registry.

Your task: Analyze the provided query results AND provide additional context from your veterinary oncology knowledge.

Guidelines:
- First, describe what's in the data (counts, percentages, comparisons, trends)
- Then, provide relevant context from veterinary/oncology knowledge if helpful
- Always note that general knowledge is supplementary - not a substitute for professional veterinary judgment
- If no data found, provide general information about the topic

Be helpful and informative while distinguishing between database findings and general knowledge.`;
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
    // Step 1: Generate SQL using ChatGPT with comprehensive schema
    console.log(`[Analytics Query] Generating SQL for: "${question}"`);
    let sqlQuery = await callChatGPT({
      systemPrompt: SQL_GENERATION_SYSTEM_PROMPT,
      userMessage: question,
    });

    console.log(`[Analytics Query] Generated SQL: ${sqlQuery.substring(0, 100)}...`);

    // Step 2: Validate the SQL before execution
    let validation = validateSQL(sqlQuery);
    
    // Step 2b: If validation failed in strict mode, try simple fallback patterns
    if (!validation.valid && mode === "strict") {
      console.log(`[Analytics Query] SQL validation failed: ${validation.error}, trying simple fallback...`);
      const fallbackSQL = trySimpleDateRangeFallback(question);
      
      if (fallbackSQL) {
        console.log(`[Analytics Query] Using fallback SQL: ${fallbackSQL}`);
        sqlQuery = fallbackSQL;
        validation = validateSQL(sqlQuery);
      }
    }
    
    if (!validation.valid) {
      console.log(`[Analytics Query] SQL validation failed: ${validation.error}`);
      
      // In universal mode, provide general knowledge when SQL generation fails
      if (mode === "universal") {
        const generalAnswer = await callChatGPT({
          systemPrompt: getUniversalModeSystemPrompt(),
          userMessage: `The question was: "${question}"\n\nI could not generate a database query for this. Please provide helpful information about this topic from your veterinary/oncology knowledge. Note that this is general knowledge, not specific to the VetOncoData database.`,
          mode,
        });

        return {
          summary: generalAnswer,
          columns: [],
          rows: [],
        };
      }

      // In strict mode, return a clear message without calling ChatGPT
      return {
        summary: 'In Strict VetOncoData mode, I can only answer questions about the cases stored in your database. I could not generate a valid query for this question. Try rephrasing it or switch to Universal Oncology AI mode to get general information.',
        columns: [],
        rows: [],
      };
    }

    // Step 3: Execute the query
    if (!dbExecutor) {
      throw new Error("Database executor is required");
    }
    
    console.log(`[Analytics Query] Executing query...`);
    const result = await dbExecutor(sqlQuery);

    // Step 4: Handle no results
    if (!result || result.length === 0) {
      console.log(`[Analytics Query] Query returned no results`);
      
      if (mode === "universal") {
        // In universal mode, ask AI for general knowledge about the topic
        const generalAnswer = await callChatGPT({
          systemPrompt: getUniversalModeSystemPrompt(),
          userMessage: `The question was: "${question}"\n\nThere is no matching data in the VetOncoData database. Please provide helpful general information about this topic from your veterinary/oncology knowledge. Note that this is general knowledge, not specific to the database.`,
          mode,
        });

        return {
          summary: generalAnswer,
          columns: [],
          rows: [],
        };
      }

      // In strict mode, return a clear message about no data
      return {
        summary: 'There are no cases in VetOncoData matching that query.',
        columns: [],
        rows: [],
      };
    }

    // Step 5: Extract columns and limit results
    const columns = Object.keys(result[0]);
    const rows = result.slice(0, 100); // Ensure we don't exceed 100 rows
    
    console.log(`[Analytics Query] Query returned ${rows.length} rows with columns: ${columns.join(', ')}`);

    // Step 6: Build context for AI analysis
    const context = buildQueryContextForAnalysis(columns, rows);

    // Step 7: Summarize results using ChatGPT based on mode
    const systemPrompt = mode === "strict" 
      ? getStrictModeSystemPrompt() 
      : getUniversalModeSystemPrompt();

    const analysisPrompt = `User question: "${question}"

${context}

Please provide a clear, natural-language explanation of these results. Include key numbers, percentages where relevant, and important patterns.`;

    console.log(`[Analytics Query] Generating analysis summary in ${mode} mode...`);
    const summary = await callChatGPT({
      systemPrompt,
      userMessage: analysisPrompt,
      mode,
    });

    // Extract case references if available in results
    const caseReferences = extractCaseReferences(rows);

    return {
      summary,
      columns,
      rows,
      caseReferences: caseReferences.length > 0 ? caseReferences : undefined,
    };
  } catch (error) {
    console.error('[executeAnalyticsQuery] Error:', error);
    throw error;
  }
}
