import { db } from '../db';
import { cases, clinics, tumourTypes, anatomicalSites } from '@shared/schema';
import { desc, eq, limit, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

/**
 * Fetch the latest cases from the database and build a text context
 * for ChatGPT to understand recent data.
 * 
 * Returns a compact, readable text snippet with recent cases and total count.
 */
export async function buildLiveDataContext(
  maxCases: number = 20
): Promise<string> {
  try {
    const creator = alias(db._.schema?.users as any, 'creator');

    // Fetch total count of cases
    const totalCountResult = await db
      .select({ count: count() })
      .from(cases);
    
    const totalCases = (totalCountResult[0]?.count as number) || 0;

    // Fetch latest cases with related data
    const recentCases = await db
      .select({
        caseId: cases.id,
        caseNumber: cases.caseNumber,
        patientName: cases.patientName,
        species: cases.species,
        state: cases.state,
        clinicName: clinics.name,
        diagnosisDate: cases.diagnosisDate,
        outcome: cases.outcome,
        tumourTypeName: tumourTypes.name,
      })
      .from(cases)
      .leftJoin(clinics, eq(cases.clinicId, clinics.id))
      .leftJoin(tumourTypes, eq(cases.tumourTypeId, tumourTypes.id))
      .orderBy(desc(cases.diagnosisDate))
      .limit(maxCases);

    if (recentCases.length === 0) {
      return 'No recent cases found in the database.';
    }

    // Format cases into readable text
    const formattedCases = recentCases
      .map((c, idx) => {
        const dateStr = c.diagnosisDate
          ? new Date(c.diagnosisDate).toLocaleDateString()
          : 'Unknown date';
        const tumourStr = c.tumourTypeName ? c.tumourTypeName : 'Not specified';
        const outcomeStr = c.outcome ? c.outcome : 'Pending';

        return `${idx + 1}) Case ${c.caseNumber} | Patient: ${c.patientName || 'N/A'} | Species: ${c.species} | Tumour: ${tumourStr} | Clinic: ${c.clinicName} | State: ${c.state} | Outcome: ${outcomeStr} | Diagnosis: ${dateStr}`;
      })
      .join('\n');

    const showingText = recentCases.length < totalCases 
      ? `Showing ${recentCases.length} most recent cases out of ${totalCases} total cases in the database.`
      : `Total of ${totalCases} case(s) in the database.`;

    return `VetOncoData Database Summary:\n${showingText}\n\nRecent cases (latest first):\n${formattedCases}`;
  } catch (error) {
    console.error('[buildLiveDataContext] Error fetching cases:', error);
    return 'Error fetching live data from database.';
  }
}
