import Papa from 'papaparse';
import { z } from 'zod';
import type { InsertCase } from '@shared/schema';

// State mapping from friendly names to database enum values
const STATE_MAP: Record<string, string> = {
  'abia': 'ABIA', 'adamawa': 'ADAMAWA', 'akwa ibom': 'AKWA_IBOM', 'anambra': 'ANAMBRA',
  'bauchi': 'BAUCHI', 'bayelsa': 'BAYELSA', 'benue': 'BENUE', 'borno': 'BORNO',
  'cross river': 'CROSS_RIVER', 'delta': 'DELTA', 'ebonyi': 'EBONYI', 'edo': 'EDO',
  'ekiti': 'EKITI', 'enugu': 'ENUGU', 'fct': 'FCT', 'gombe': 'GOMBE', 'imo': 'IMO',
  'jigawa': 'JIGAWA', 'kaduna': 'KADUNA', 'kano': 'KANO', 'katsina': 'KATSINA',
  'kebbi': 'KEBBI', 'kogi': 'KOGI', 'kwara': 'KWARA', 'lagos': 'LAGOS',
  'nasarawa': 'NASARAWA', 'niger': 'NIGER', 'ogun': 'OGUN', 'ondo': 'ONDO',
  'osun': 'OSUN', 'oyo': 'OYO', 'plateau': 'PLATEAU', 'rivers': 'RIVERS',
  'sokoto': 'SOKOTO', 'taraba': 'TARABA', 'yobe': 'YOBE', 'zamfara': 'ZAMFARA'
};

// Zone mapping
const STATE_TO_ZONE: Record<string, string> = {
  'ABIA': 'SOUTH_EAST', 'ADAMAWA': 'NORTH_EAST', 'AKWA_IBOM': 'SOUTH_SOUTH', 'ANAMBRA': 'SOUTH_EAST',
  'BAUCHI': 'NORTH_EAST', 'BAYELSA': 'SOUTH_SOUTH', 'BENUE': 'NORTH_CENTRAL', 'BORNO': 'NORTH_EAST',
  'CROSS_RIVER': 'SOUTH_SOUTH', 'DELTA': 'SOUTH_SOUTH', 'EBONYI': 'SOUTH_EAST', 'EDO': 'SOUTH_SOUTH',
  'EKITI': 'SOUTH_WEST', 'ENUGU': 'SOUTH_EAST', 'FCT': 'NORTH_CENTRAL', 'GOMBE': 'NORTH_EAST',
  'IMO': 'SOUTH_EAST', 'JIGAWA': 'NORTH_WEST', 'KADUNA': 'NORTH_WEST', 'KANO': 'NORTH_WEST',
  'KATSINA': 'NORTH_WEST', 'KEBBI': 'NORTH_WEST', 'KOGI': 'NORTH_CENTRAL', 'KWARA': 'NORTH_CENTRAL',
  'LAGOS': 'SOUTH_WEST', 'NASARAWA': 'NORTH_CENTRAL', 'NIGER': 'NORTH_CENTRAL', 'OGUN': 'SOUTH_WEST',
  'ONDO': 'SOUTH_WEST', 'OSUN': 'SOUTH_WEST', 'OYO': 'SOUTH_WEST', 'PLATEAU': 'NORTH_CENTRAL',
  'RIVERS': 'SOUTH_SOUTH', 'SOKOTO': 'NORTH_WEST', 'TARABA': 'NORTH_EAST', 'YOBE': 'NORTH_EAST',
  'ZAMFARA': 'NORTH_WEST'
};

// CSV Row schema with preprocessing
const csvRowSchema = z.object({
  species: z.string().min(1, "Species is required"),
  breed: z.string().min(1, "Breed is required"),
  state: z.string().min(1, "State is required").transform((val) => {
    const normalized = STATE_MAP[val.toLowerCase().trim()];
    if (!normalized) {
      throw new Error(`Invalid state: ${val}. Must be a valid Nigerian state.`);
    }
    return normalized;
  }),
  diagnosis_date: z.string().min(1, "Diagnosis date is required").transform((val) => {
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid diagnosis date: ${val}. Use YYYY-MM-DD format.`);
    }
    return date;
  }),
  patient_name: z.string().optional().transform(v => v || null),
  sex: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return null;
    const normalized = val.toUpperCase().replace(/\s+/g, '_');
    const valid = ['MALE_NEUTERED', 'MALE_INTACT', 'FEMALE_SPAYED', 'FEMALE_INTACT'];
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid sex: ${val}. Must be one of: ${valid.join(', ')}`);
    }
    return normalized;
  }),
  age_years: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return null;
    const num = parseInt(val);
    if (isNaN(num) || num < 0) {
      throw new Error(`Invalid age_years: ${val}. Must be a positive number.`);
    }
    return num;
  }),
  age_months: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return null;
    const num = parseInt(val);
    if (isNaN(num) || num < 0 || num > 11) {
      throw new Error(`Invalid age_months: ${val}. Must be 0-11.`);
    }
    return num;
  }),
  tumour_type: z.string().optional().transform(v => v || null),
  tumour_type_custom: z.string().optional().transform(v => v || null),
  anatomical_site: z.string().optional().transform(v => v || null),
  anatomical_site_custom: z.string().optional().transform(v => v || null),
  laterality: z.string().optional().transform(v => v || null),
  stage: z.string().optional().transform(v => v || null),
  diagnosis_method: z.string().optional().transform(v => v || null),
  treatment_plan: z.string().optional().transform(v => v || null),
  treatment_start: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return null;
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid treatment_start: ${val}. Use YYYY-MM-DD format.`);
    }
    return date;
  }),
  outcome: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return null;
    const normalized = val.toUpperCase().replace(/\s+/g, '_');
    const valid = ['REMISSION', 'TREATMENT_ONGOING', 'DECEASED', 'LOST_TO_FOLLOWUP'];
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid outcome: ${val}. Must be one of: ${valid.join(', ')}`);
    }
    return normalized;
  }),
  last_follow_up: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return null;
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid last_follow_up: ${val}. Use YYYY-MM-DD format.`);
    }
    return date;
  }),
  notes: z.string().optional().transform(v => v || null),
});

export interface ParsedRow {
  data: Partial<InsertCase>;
  error?: string;
}

export interface CSVParseResult {
  success: boolean;
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  error?: string;
}

export async function parseCSVFile(filePath: string, clinicId: string, userId: string): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    const rows: ParsedRow[] = [];
    let totalRows = 0;
    let validRows = 0;

    Papa.parse(filePath, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      comments: '#',
      step: (result, parser) => {
        totalRows++;
        const rowNum = totalRows;

        try {
          const validated = csvRowSchema.parse(result.data);
          
          // Compute geo zone from state
          const geoZone = STATE_TO_ZONE[validated.state as string];
          
          // Build InsertCase object
          const caseData: Partial<InsertCase> = {
            clinicId,
            createdBy: userId,
            species: validated.species,
            breed: validated.breed,
            state: validated.state as any,
            geoZone: geoZone as any,
            diagnosisDate: validated.diagnosis_date,
            patientName: validated.patient_name,
            sex: validated.sex as any,
            ageYears: validated.age_years,
            ageMonths: validated.age_months,
            tumourTypeCustom: validated.tumour_type_custom || validated.tumour_type,
            anatomicalSiteCustom: validated.anatomical_site_custom || validated.anatomical_site,
            laterality: validated.laterality,
            stage: validated.stage,
            diagnosisMethod: validated.diagnosis_method,
            treatmentPlan: validated.treatment_plan,
            treatmentStart: validated.treatment_start,
            outcome: validated.outcome as any,
            lastFollowUp: validated.last_follow_up,
            notes: validated.notes,
            status: 'ACTIVE',
          };

          rows.push({ data: caseData });
          validRows++;
        } catch (error) {
          const errorMsg = error instanceof z.ZodError 
            ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
            : error instanceof Error 
            ? error.message 
            : 'Unknown validation error';
          
          rows.push({ 
            data: result.data as any, 
            error: `Row ${rowNum}: ${errorMsg}` 
          });
        }
      },
      complete: () => {
        resolve({
          success: true,
          rows,
          totalRows,
          validRows,
        });
      },
      error: (error: Error) => {
        resolve({
          success: false,
          rows: [],
          totalRows: 0,
          validRows: 0,
          error: error.message,
        });
      },
    });
  });
}
