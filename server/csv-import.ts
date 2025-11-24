import Papa from 'papaparse';
import { z } from 'zod';
import { readFile } from 'fs/promises';
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

// CSV Row schema with preprocessing - lenient validation that imports blanks instead of failing
const csvRowSchema = z.object({
  species: z.string().optional().transform(v => v?.trim() || undefined),
  breed: z.string().optional().transform(v => v?.trim() || undefined),
  state: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const normalized = STATE_MAP[val.toLowerCase().trim()];
    return normalized || undefined; // Return undefined if state not found instead of throwing
  }),
  diagnosis_date: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date; // Return undefined if invalid date instead of throwing
  }),
  patient_name: z.string().optional().transform(v => v?.trim() || undefined),
  sex: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const normalized = val.toUpperCase().replace(/\s+/g, '_');
    const valid = ['MALE_NEUTERED', 'MALE_INTACT', 'FEMALE_SPAYED', 'FEMALE_INTACT'];
    return valid.includes(normalized) ? normalized : undefined; // Return undefined if invalid sex instead of throwing
  }),
  age_years: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const num = parseInt(val);
    return (isNaN(num) || num < 0) ? undefined : num; // Return undefined if invalid age instead of throwing
  }),
  age_months: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const num = parseInt(val);
    return (isNaN(num) || num < 0 || num > 11) ? undefined : num; // Return undefined if invalid months instead of throwing
  }),
  tumour_type: z.string().optional().transform(v => v?.trim() || undefined),
  tumour_type_custom: z.string().optional().transform(v => v?.trim() || undefined),
  anatomical_site: z.string().optional().transform(v => v?.trim() || undefined),
  anatomical_site_custom: z.string().optional().transform(v => v?.trim() || undefined),
  laterality: z.string().optional().transform(v => v?.trim() || undefined),
  stage: z.string().optional().transform(v => v?.trim() || undefined),
  diagnosis_method: z.string().optional().transform(v => v?.trim() || undefined),
  treatment_plan: z.string().optional().transform(v => v?.trim() || undefined),
  treatment_start: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date; // Return undefined if invalid date instead of throwing
  }),
  outcome: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const normalized = val.toUpperCase().replace(/\s+/g, '_');
    const valid = ['REMISSION', 'MORTALITY', 'EUTHANASIA', 'TREATMENT_ONGOING', 'MANAGEMENT'];
    return valid.includes(normalized) ? normalized : undefined; // Return undefined if invalid outcome instead of throwing
  }),
  last_follow_up: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date; // Return undefined if invalid date instead of throwing
  }),
  notes: z.string().optional().transform(v => v?.trim() || undefined),
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
  try {
    // Read the file contents first
    const fileContent = await readFile(filePath, 'utf-8');
    
    return new Promise((resolve) => {
      const rows: ParsedRow[] = [];
      let totalRows = 0;
      let validRows = 0;

      Papa.parse(fileContent, {
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
  } catch (error) {
    return {
      success: false,
      rows: [],
      totalRows: 0,
      validRows: 0,
      error: error instanceof Error ? error.message : 'Failed to read CSV file',
    };
  }
}
