import { db } from '../db';
import { sql } from 'drizzle-orm';

let HAS_NG_STATES: boolean | null = null;

export async function hasNgStates(): Promise<boolean> {
  if (HAS_NG_STATES !== null) return HAS_NG_STATES;
  
  try {
    const res = await db.execute(
      sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'ng_states' LIMIT 1`
    );
    HAS_NG_STATES = res.rows.length > 0;
  } catch (error) {
    console.error('[hasNgStates] Error checking for ng_states table:', error);
    HAS_NG_STATES = false;
  }
  
  return HAS_NG_STATES;
}

export function resetCapabilityCache() {
  HAS_NG_STATES = null;
}
