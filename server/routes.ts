import { callChatGPT } from './openaiClient';

const SCHEMA_DESCRIPTION = `Veterinary Oncology Case Form Schema:

Species (common): Dog, Cat, Cattle, Horse, Rabbit, Bird, Other
Sex: MALE_INTACT, MALE_NEUTERED, FEMALE_INTACT, FEMALE_SPAYED, Unknown
Age: Years (0-30) and Months (0-11)
Diagnosis Methods: FNA, Biopsy, Imaging, Clinical, Histopathology, Unknown
Stages: I, II, III, IV (when applicable)
Common Tumour Types: Mast Cell Tumor, Lymphoma, Hemangiosarcoma, Melanoma, Osteosarcoma, Squamous Cell Carcinoma, Soft Tissue Sarcoma, Other
Anatomical Sites: Skin, Subcutaneous, Oral, Gastrointestinal, Urinary, Reproductive, Bone, Other
Laterality: Left, Right, Bilateral, Central`;

const SYSTEM_PROMPT = `You are helping a veterinarian fill out an oncology case form. 
Your task is to parse free-text clinical notes and suggest structured form field values.

Rules:
1. Return ONLY valid JSON, no extra text or explanations
2. Only include fields where you can make a confident suggestion
3. Use null for any field you cannot confidently suggest
4. Do NOT invent impossible values; if unsure, use null
5. For age: return as separate ageYears and ageMonths (both null if unsure)
6. Validate that suggested values match the schema

Schema: ${SCHEMA_DESCRIPTION}

Return JSON with this structure (omit any fields with null):
{
  "species": "string or null",
  "breed": "string or null",
  "sex": "MALE_INTACT | MALE_NEUTERED | FEMALE_INTACT | FEMALE_SPAYED | Unknown or null",
  "ageYears": "number (0-30) or null",
  "ageMonths": "number (0-11) or null",
  "tumourType": "string or null",
  "anatomicalSite": "string or null",
  "stage": "I | II | III | IV or null",
  "diagnosisMethod": "FNA | Biopsy | Imaging | Clinical | Histopathology | Unknown or null",
  "notesSummary": "brief 1-2 line clinical summary or null"
}`;

export interface CaseFormSuggestions {
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  ageYears?: number | null;
  ageMonths?: number | null;
  tumourType?: string | null;
  anatomicalSite?: string | null;
  stage?: string | null;
  diagnosisMethod?: string | null;
  notesSummary?: string | null;
}

/**
 * Parse clinical notes using ChatGPT and suggest case form field values
 */
export async function suggestCaseFormValues(text: string): Promise<{ suggested: CaseFormSuggestions }> {
  try {
    if (!text || text.trim().length === 0) {
      return { suggested: {} };
    }

    // Call ChatGPT to parse the notes
    const response = await callChatGPT({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Please analyze the following clinical notes and suggest form field values:\n\n${text}`,
    });

    // Parse the JSON response
    let suggestions: CaseFormSuggestions;
    try {
      suggestions = JSON.parse(response);
    } catch (parseError) {
      console.error('[suggestCaseFormValues] Failed to parse JSON response:', response);
      return { suggested: {} };
    }

    // Validate and sanitize suggestions
    const validated = validateSuggestions(suggestions);
    return { suggested: validated };
  } catch (error) {
    console.error('[suggestCaseFormValues] Error:', error);
    throw error;
  }
}

/**
 * Validate and sanitize AI suggestions
 */
function validateSuggestions(suggestions: any): CaseFormSuggestions {
  const validated: CaseFormSuggestions = {};

  // Species - allow strings only
  if (suggestions.species && typeof suggestions.species === 'string' && suggestions.species.length > 0) {
    validated.species = suggestions.species.trim();
  }

  // Breed - allow strings only
  if (suggestions.breed && typeof suggestions.breed === 'string' && suggestions.breed.length > 0) {
    validated.breed = suggestions.breed.trim();
  }

  // Sex - validate against allowed values
  const validSexValues = ['MALE_INTACT', 'MALE_NEUTERED', 'FEMALE_INTACT', 'FEMALE_SPAYED', 'Unknown'];
  if (suggestions.sex && validSexValues.includes(suggestions.sex)) {
    validated.sex = suggestions.sex;
  }

  // Age - validate ranges
  if (typeof suggestions.ageYears === 'number' && suggestions.ageYears >= 0 && suggestions.ageYears <= 30) {
    validated.ageYears = Math.floor(suggestions.ageYears);
  }
  if (typeof suggestions.ageMonths === 'number' && suggestions.ageMonths >= 0 && suggestions.ageMonths <= 11) {
    validated.ageMonths = Math.floor(suggestions.ageMonths);
  }

  // Tumour Type - allow strings only
  if (suggestions.tumourType && typeof suggestions.tumourType === 'string' && suggestions.tumourType.length > 0) {
    validated.tumourType = suggestions.tumourType.trim();
  }

  // Anatomical Site - allow strings only
  if (suggestions.anatomicalSite && typeof suggestions.anatomicalSite === 'string' && suggestions.anatomicalSite.length > 0) {
    validated.anatomicalSite = suggestions.anatomicalSite.trim();
  }

  // Stage - validate
  const validStages = ['I', 'II', 'III', 'IV'];
  if (suggestions.stage && validStages.includes(suggestions.stage)) {
    validated.stage = suggestions.stage;
  }

  // Diagnosis Method - validate
  const validDiagnosisMethods = ['FNA', 'Biopsy', 'Imaging', 'Clinical', 'Histopathology', 'Unknown'];
  if (suggestions.diagnosisMethod && validDiagnosisMethods.includes(suggestions.diagnosisMethod)) {
    validated.diagnosisMethod = suggestions.diagnosisMethod;
  }

  // Notes Summary - allow strings only
  if (suggestions.notesSummary && typeof suggestions.notesSummary === 'string' && suggestions.notesSummary.length > 0) {
    validated.notesSummary = suggestions.notesSummary.trim();
  }

  return validated;
}
