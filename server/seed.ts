import { db } from "./db";
import { ngStates, tumourTypes, anatomicalSites } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Nigerian states with geo-political zone mapping
const nigerianStates = [
  // North Central
  { code: "BENUE", name: "Benue", zone: "NORTH_CENTRAL" as const },
  { code: "KOGI", name: "Kogi", zone: "NORTH_CENTRAL" as const },
  { code: "KWARA", name: "Kwara", zone: "NORTH_CENTRAL" as const },
  { code: "NASARAWA", name: "Nasarawa", zone: "NORTH_CENTRAL" as const },
  { code: "NIGER", name: "Niger", zone: "NORTH_CENTRAL" as const },
  { code: "PLATEAU", name: "Plateau", zone: "NORTH_CENTRAL" as const },
  { code: "FCT", name: "FCT", zone: "NORTH_CENTRAL" as const },
  
  // North East
  { code: "ADAMAWA", name: "Adamawa", zone: "NORTH_EAST" as const },
  { code: "BAUCHI", name: "Bauchi", zone: "NORTH_EAST" as const },
  { code: "BORNO", name: "Borno", zone: "NORTH_EAST" as const },
  { code: "GOMBE", name: "Gombe", zone: "NORTH_EAST" as const },
  { code: "TARABA", name: "Taraba", zone: "NORTH_EAST" as const },
  { code: "YOBE", name: "Yobe", zone: "NORTH_EAST" as const },
  
  // North West
  { code: "JIGAWA", name: "Jigawa", zone: "NORTH_WEST" as const },
  { code: "KADUNA", name: "Kaduna", zone: "NORTH_WEST" as const },
  { code: "KANO", name: "Kano", zone: "NORTH_WEST" as const },
  { code: "KATSINA", name: "Katsina", zone: "NORTH_WEST" as const },
  { code: "KEBBI", name: "Kebbi", zone: "NORTH_WEST" as const },
  { code: "SOKOTO", name: "Sokoto", zone: "NORTH_WEST" as const },
  { code: "ZAMFARA", name: "Zamfara", zone: "NORTH_WEST" as const },
  
  // South East
  { code: "ABIA", name: "Abia", zone: "SOUTH_EAST" as const },
  { code: "ANAMBRA", name: "Anambra", zone: "SOUTH_EAST" as const },
  { code: "EBONYI", name: "Ebonyi", zone: "SOUTH_EAST" as const },
  { code: "ENUGU", name: "Enugu", zone: "SOUTH_EAST" as const },
  { code: "IMO", name: "Imo", zone: "SOUTH_EAST" as const },
  
  // South South
  { code: "AKWA_IBOM", name: "Akwa Ibom", zone: "SOUTH_SOUTH" as const },
  { code: "BAYELSA", name: "Bayelsa", zone: "SOUTH_SOUTH" as const },
  { code: "CROSS_RIVER", name: "Cross River", zone: "SOUTH_SOUTH" as const },
  { code: "DELTA", name: "Delta", zone: "SOUTH_SOUTH" as const },
  { code: "EDO", name: "Edo", zone: "SOUTH_SOUTH" as const },
  { code: "RIVERS", name: "Rivers", zone: "SOUTH_SOUTH" as const },
  
  // South West
  { code: "EKITI", name: "Ekiti", zone: "SOUTH_WEST" as const },
  { code: "LAGOS", name: "Lagos", zone: "SOUTH_WEST" as const },
  { code: "OGUN", name: "Ogun", zone: "SOUTH_WEST" as const },
  { code: "ONDO", name: "Ondo", zone: "SOUTH_WEST" as const },
  { code: "OSUN", name: "Osun", zone: "SOUTH_WEST" as const },
  { code: "OYO", name: "Oyo", zone: "SOUTH_WEST" as const },
];

// Common canine and feline tumour types
const commonTumourTypes = [
  { name: "Lymphoma", species: null, isSystem: true },
  { name: "Mast Cell Tumour", species: null, isSystem: true },
  { name: "Osteosarcoma", species: "Canine", isSystem: true },
  { name: "Hemangiosarcoma", species: "Canine", isSystem: true },
  { name: "Soft Tissue Sarcoma", species: null, isSystem: true },
  { name: "Melanoma", species: null, isSystem: true },
  { name: "Squamous Cell Carcinoma", species: null, isSystem: true },
  { name: "Mammary Carcinoma", species: null, isSystem: true },
  { name: "Fibrosarcoma", species: null, isSystem: true },
  { name: "Transitional Cell Carcinoma", species: null, isSystem: true },
  { name: "Meningioma", species: null, isSystem: true },
  { name: "Oral Melanoma", species: "Canine", isSystem: true },
  { name: "Hepatocellular Carcinoma", species: null, isSystem: true },
  { name: "Insulinoma", species: null, isSystem: true },
  { name: "Anal Sac Adenocarcinoma", species: "Canine", isSystem: true },
  { name: "Thyroid Carcinoma", species: null, isSystem: true },
  { name: "Nasal Adenocarcinoma", species: null, isSystem: true },
  { name: "Leukemia (CLL)", species: null, isSystem: true },
  { name: "Leukemia (ALL)", species: null, isSystem: true },
  { name: "GI Lymphoma", species: null, isSystem: true },
  { name: "Osteoma", species: null, isSystem: true },
  { name: "Histiocytic Sarcoma", species: "Canine", isSystem: true },
  { name: "Apocrine Gland Adenocarcinoma", species: null, isSystem: true },
];

// Common anatomical sites
const commonAnatomicalSites = [
  { name: "Skin", species: null, isSystem: true },
  { name: "Subcutis", species: null, isSystem: true },
  { name: "Oral Cavity", species: null, isSystem: true },
  { name: "Nasal Cavity", species: null, isSystem: true },
  { name: "Limbs", species: null, isSystem: true },
  { name: "Mammary Gland", species: null, isSystem: true },
  { name: "Spleen", species: null, isSystem: true },
  { name: "Liver", species: null, isSystem: true },
  { name: "Kidney", species: null, isSystem: true },
  { name: "Bladder", species: null, isSystem: true },
  { name: "Prostate", species: null, isSystem: true },
  { name: "Brain/CNS", species: null, isSystem: true },
  { name: "Eye/Orbit", species: null, isSystem: true },
  { name: "Bone", species: null, isSystem: true },
  { name: "Lymph Node", species: null, isSystem: true },
  { name: "GI Tract", species: null, isSystem: true },
  { name: "Lung", species: null, isSystem: true },
  { name: "Perianal Region", species: null, isSystem: true },
  { name: "Endocrine", species: null, isSystem: true },
  { name: "Reproductive", species: null, isSystem: true },
  { name: "Mediastinum", species: null, isSystem: true },
  { name: "Heart", species: null, isSystem: true },
];

/**
 * Seed database with Nigerian states, tumour types, and anatomical sites
 */
export async function seedDatabase() {
  console.log("🌱 Starting database seed...");

  try {
    // Seed Nigerian states
    console.log("📍 Seeding Nigerian states...");
    for (const state of nigerianStates) {
      await db
        .insert(ngStates)
        .values(state)
        .onConflictDoNothing();
    }
    console.log(`✅ Seeded ${nigerianStates.length} states`);

    // Seed tumour types
    console.log("🔬 Seeding tumour types...");
    for (const tumourType of commonTumourTypes) {
      await db
        .insert(tumourTypes)
        .values(tumourType)
        .onConflictDoNothing();
    }
    console.log(`✅ Seeded ${commonTumourTypes.length} tumour types`);

    // Seed anatomical sites
    console.log("📍 Seeding anatomical sites...");
    for (const site of commonAnatomicalSites) {
      await db
        .insert(anatomicalSites)
        .values(site)
        .onConflictDoNothing();
    }
    console.log(`✅ Seeded ${commonAnatomicalSites.length} anatomical sites`);

    console.log("🎉 Database seed completed successfully!");
  } catch (error) {
    console.error("❌ Database seed failed:", error);
    throw error;
  }
}

// Utility function to get geo-zone from state code
export function getGeoZoneFromState(stateCode: string): string | null {
  const state = nigerianStates.find(s => s.code === stateCode);
  return state?.zone || null;
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
