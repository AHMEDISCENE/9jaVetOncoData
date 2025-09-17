import bcrypt from "bcrypt";
import { storage } from "./storage";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createUserWithClinic(userData: {
  email: string;
  name: string;
  password: string;
  clinicName: string;
  clinicState: string;
  clinicCity: string;
  clinicLga?: string;
}) {
  const hashedPassword = await hashPassword(userData.password);
  
  // Create clinic first
  const clinic = await storage.createClinic({
    name: userData.clinicName,
    state: userData.clinicState as any,
    city: userData.clinicCity,
    lga: userData.clinicLga,
  });
  
  // Create user as admin of the clinic
  const user = await storage.createUser({
    email: userData.email,
    name: userData.name,
    password: hashedPassword,
    role: "ADMIN",
    clinicId: clinic.id,
  });
  
  return { user, clinic };
}

export async function authenticateUser(email: string, password: string) {
  const user = await storage.getUserByEmail(email);
  if (!user || !user.password) {
    return null;
  }
  
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }
  
  await storage.updateLastLogin(user.id);
  return user;
}

export interface SessionData {
  userId: string;
  userRole: string;
  clinicId: string;
}

export function createSessionData(user: any): SessionData {
  return {
    userId: user.id,
    userRole: user.role,
    clinicId: user.clinicId,
  };
}
