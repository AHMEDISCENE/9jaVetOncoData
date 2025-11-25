import { callChatGPT } from './openaiClient';

export interface CaseSuggestion {
  species?: string;
  breed?: string;
  sex?: string;
  ageYears?: number;
  ageMonths?: number;
  diagnosisMethod?: string;
  tumourTypeCustom?: string;
  anatomicalSiteCustom?: string;
  laterality?: string;
  stage?: string;
  treatmentPlan?: string;
  notes?: string;
}

const SYSTEM_PROMPT = `You are an expert veterinary oncology assistant. Your task is to extract structured clinical information from free-text clinical notes and suggest values for a veterinary case form.

Extract and suggest the following fields if mentioned:
- species: The animal species (e.g., Dog, Cat, Bird, Rabbit)
- breed: The breed of the animal
- sex: Sex of the animal (Male, Female, Unknown)
- ageYears: Age in years (number only)
- ageMonths: Age in additional months (0-11)
- diagnosisMethod: How diagnosis was made (e.g., Cytology, Biopsy, Ultrasound, Clinical examination)
- tumourTypeCustom: Type of tumor (e.g., Hemangiosarcoma, Lymphoma, Mast cell tumor, Squamous cell carcinoma)
- anatomicalSiteCustom: Location of the tumor (e.g., Spleen, Liver, Bone, Skin, Soft tissue)
- laterality: Which side if applicable (Left, Right, Bilateral, Central)
- stage: Tumor stage if mentioned (e.g., Stage I, Stage II, Stage III, Stage IV)
- treatmentPlan: Planned treatment (e.g., Surgery, Chemotherapy, Radiation, Palliative care)
- notes: Any additional clinical notes that don't fit other fields

Return ONLY a valid JSON object with these fields. Only include fields that are clearly mentioned or strongly inferred from the text. Do not make up information.

Example input: "Golden Retriever, 8 years old female. Left front leg swelling over 2 months. Ultrasound and biopsy showed osteosarcoma, Stage III. Plan: surgical amputation followed by chemotherapy."

Example output:
{
  "species": "Dog",
  "breed": "Golden Retriever",
  "sex": "Female",
  "ageYears": 8,
  "diagnosisMethod": "Ultrasound and biopsy",
  "tumourTypeCustom": "Osteosarcoma",
  "anatomicalSiteCustom": "Front leg",
  "laterality": "Left",
  "stage": "Stage III",
  "treatmentPlan": "Surgical amputation followed by chemotherapy"
}`;

export async function suggestCaseFields(notes: string): Promise<CaseSuggestion> {
  try {
    const response = await callChatGPT({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Extract clinical information from these notes:\n\n${notes}`,
    });

    // Parse the JSON response
    let suggestion: CaseSuggestion = {};
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestion = {
          species: parsed.species || undefined,
          breed: parsed.breed || undefined,
          sex: parsed.sex || undefined,
          ageYears: parsed.ageYears || undefined,
          ageMonths: parsed.ageMonths || undefined,
          diagnosisMethod: parsed.diagnosisMethod || undefined,
          tumourTypeCustom: parsed.tumourTypeCustom || undefined,
          anatomicalSiteCustom: parsed.anatomicalSiteCustom || undefined,
          laterality: parsed.laterality || undefined,
          stage: parsed.stage || undefined,
          treatmentPlan: parsed.treatmentPlan || undefined,
          notes: parsed.notes || undefined,
        };
      }
    } catch (parseError) {
      console.warn('Failed to parse JSON from ChatGPT response:', response);
      // Return empty suggestions if parsing fails
      suggestion = {};
    }

    return suggestion;
  } catch (error) {
    console.error('[suggestCaseFields] Error:', error);
    throw error;
  }
}
