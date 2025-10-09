// Nigeria States and Geo-political Zones

export type GeoZone = 
  | "NORTH_CENTRAL"
  | "NORTH_EAST" 
  | "NORTH_WEST"
  | "SOUTH_EAST"
  | "SOUTH_SOUTH"
  | "SOUTH_WEST";

export const NIGERIA_STATES = [
  "ABIA", "ADAMAWA", "AKWA_IBOM", "ANAMBRA", "BAUCHI", "BAYELSA",
  "BENUE", "BORNO", "CROSS_RIVER", "DELTA", "EBONYI", "EDO",
  "EKITI", "ENUGU", "FCT", "GOMBE", "IMO", "JIGAWA",
  "KADUNA", "KANO", "KATSINA", "KEBBI", "KOGI", "KWARA",
  "LAGOS", "NASARAWA", "NIGER", "OGUN", "ONDO", "OSUN",
  "OYO", "PLATEAU", "RIVERS", "SOKOTO", "TARABA", "YOBE", "ZAMFARA"
] as const;

export type NigeriaState = typeof NIGERIA_STATES[number];

export const STATE_TO_ZONE_MAP: Record<string, GeoZone> = {
  // North Central
  "BENUE": "NORTH_CENTRAL",
  "KOGI": "NORTH_CENTRAL",
  "KWARA": "NORTH_CENTRAL",
  "NASARAWA": "NORTH_CENTRAL",
  "NIGER": "NORTH_CENTRAL",
  "PLATEAU": "NORTH_CENTRAL",
  "FCT": "NORTH_CENTRAL",
  
  // North East
  "ADAMAWA": "NORTH_EAST",
  "BAUCHI": "NORTH_EAST",
  "BORNO": "NORTH_EAST",
  "GOMBE": "NORTH_EAST",
  "TARABA": "NORTH_EAST",
  "YOBE": "NORTH_EAST",
  
  // North West
  "JIGAWA": "NORTH_WEST",
  "KADUNA": "NORTH_WEST",
  "KANO": "NORTH_WEST",
  "KATSINA": "NORTH_WEST",
  "KEBBI": "NORTH_WEST",
  "SOKOTO": "NORTH_WEST",
  "ZAMFARA": "NORTH_WEST",
  
  // South East
  "ABIA": "SOUTH_EAST",
  "ANAMBRA": "SOUTH_EAST",
  "EBONYI": "SOUTH_EAST",
  "ENUGU": "SOUTH_EAST",
  "IMO": "SOUTH_EAST",
  
  // South South
  "AKWA_IBOM": "SOUTH_SOUTH",
  "BAYELSA": "SOUTH_SOUTH",
  "CROSS_RIVER": "SOUTH_SOUTH",
  "DELTA": "SOUTH_SOUTH",
  "EDO": "SOUTH_SOUTH",
  "RIVERS": "SOUTH_SOUTH",
  
  // South West
  "EKITI": "SOUTH_WEST",
  "LAGOS": "SOUTH_WEST",
  "OGUN": "SOUTH_WEST",
  "ONDO": "SOUTH_WEST",
  "OSUN": "SOUTH_WEST",
  "OYO": "SOUTH_WEST",
};

export function getZoneForState(state: string): GeoZone | null {
  return STATE_TO_ZONE_MAP[state] || null;
}

export function formatStateName(state: string): string {
  return state
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatZoneName(zone: GeoZone): string {
  return zone
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export const SPECIES_BREEDS: Record<string, string[]> = {
  "Dog": [
    "Mongrel (Mixed)", "Boerboel", "Rottweiler", "German Shepherd", "Lhasa Apso", 
    "Caucasian Shepherd", "Pit Bull Terrier", "Labrador Retriever", "Golden Retriever", 
    "Poodle", "Chihuahua", "Dobermann", "English Bulldog", "Cane Corso", 
    "American Eskimo", "Great Dane", "Maltese", "Shih Tzu"
  ],
  "Cat": [
    "Domestic Shorthair", "Domestic Longhair", "Persian", "Siamese", 
    "British Shorthair", "American Shorthair", "Maine Coon", "Bengal", 
    "Sphynx", "Russian Blue"
  ],
};
