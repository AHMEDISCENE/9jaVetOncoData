export const ZONES = [
  'North Central', 'North East', 'North West', 'South East', 'South South', 'South West',
] as const;

export type GeoZone = typeof ZONES[number];

export const STATE_TO_ZONE: Record<string, GeoZone> = {
  // North Central
  'BENUE': 'North Central',
  'KOGI': 'North Central',
  'KWARA': 'North Central',
  'NASARAWA': 'North Central',
  'NIGER': 'North Central',
  'PLATEAU': 'North Central',
  'FCT': 'North Central',
  
  // North East
  'ADAMAWA': 'North East',
  'BAUCHI': 'North East',
  'BORNO': 'North East',
  'GOMBE': 'North East',
  'TARABA': 'North East',
  'YOBE': 'North East',
  
  // North West
  'JIGAWA': 'North West',
  'KADUNA': 'North West',
  'KANO': 'North West',
  'KATSINA': 'North West',
  'KEBBI': 'North West',
  'SOKOTO': 'North West',
  'ZAMFARA': 'North West',
  
  // South East
  'ABIA': 'South East',
  'ANAMBRA': 'South East',
  'EBONYI': 'South East',
  'ENUGU': 'South East',
  'IMO': 'South East',
  
  // South South
  'AKWA_IBOM': 'South South',
  'BAYELSA': 'South South',
  'CROSS_RIVER': 'South South',
  'DELTA': 'South South',
  'EDO': 'South South',
  'RIVERS': 'South South',
  
  // South West
  'EKITI': 'South West',
  'LAGOS': 'South West',
  'OGUN': 'South West',
  'ONDO': 'South West',
  'OSUN': 'South West',
  'OYO': 'South West',
};

export function computeZoneFromState(state?: string | null): GeoZone | 'Unknown' {
  if (!state) return 'Unknown';
  // Normalize state name: uppercase and replace spaces with underscores
  const key = state.trim().toUpperCase().replace(/\s+/g, '_');
  return (STATE_TO_ZONE[key] ?? 'Unknown') as GeoZone | 'Unknown';
}

export function statesForZones(zones: string[]): string[] {
  // Normalize input zones: convert underscores to spaces and lowercase for comparison
  const wanted = new Set(zones.map(z => z.trim().toLowerCase().replace(/_/g, ' ')));
  return Object.entries(STATE_TO_ZONE)
    .filter(([, zone]) => wanted.has(zone.toLowerCase()))
    .map(([state]) => state); // Returns uppercase with underscores
}
