export const ZONES = [
  'North Central', 'North East', 'North West', 'South East', 'South South', 'South West',
] as const;

export type GeoZone = typeof ZONES[number];

export const STATE_TO_ZONE: Record<string, GeoZone> = {
  // North Central
  'benue': 'North Central',
  'kogi': 'North Central',
  'kwara': 'North Central',
  'nasarawa': 'North Central',
  'niger': 'North Central',
  'plateau': 'North Central',
  'fct': 'North Central',
  'abuja': 'North Central',
  
  // North East
  'adamawa': 'North East',
  'bauchi': 'North East',
  'borno': 'North East',
  'gombe': 'North East',
  'taraba': 'North East',
  'yobe': 'North East',
  
  // North West
  'jigawa': 'North West',
  'kaduna': 'North West',
  'kano': 'North West',
  'katsina': 'North West',
  'kebbi': 'North West',
  'sokoto': 'North West',
  'zamfara': 'North West',
  
  // South East
  'abia': 'South East',
  'anambra': 'South East',
  'ebonyi': 'South East',
  'enugu': 'South East',
  'imo': 'South East',
  
  // South South
  'akwa ibom': 'South South',
  'bayelsa': 'South South',
  'cross river': 'South South',
  'delta': 'South South',
  'edo': 'South South',
  'rivers': 'South South',
  
  // South West
  'ekiti': 'South West',
  'lagos': 'South West',
  'ogun': 'South West',
  'ondo': 'South West',
  'osun': 'South West',
  'oyo': 'South West',
};

export function computeZoneFromState(state?: string | null): GeoZone | 'Unknown' {
  if (!state) return 'Unknown';
  const key = state.trim().toLowerCase();
  return (STATE_TO_ZONE[key] ?? 'Unknown') as GeoZone | 'Unknown';
}

export function statesForZones(zones: string[]): string[] {
  const wanted = new Set(zones.map(z => z.trim().toLowerCase()));
  return Object.entries(STATE_TO_ZONE)
    .filter(([, zone]) => wanted.has(zone.toLowerCase()))
    .map(([state]) => state);
}
