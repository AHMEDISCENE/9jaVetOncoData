import { apiRequest } from "./queryClient";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
  clinicName: string;
  clinicState: string;
  clinicCity: string;
}

export async function login(credentials: LoginCredentials) {
  const response = await apiRequest("POST", "/api/auth/login", credentials);
  return response.json();
}

export async function register(data: RegisterData) {
  const response = await apiRequest("POST", "/api/auth/register", data);
  return response.json();
}

export async function logout() {
  await apiRequest("POST", "/api/auth/logout");
}

export async function getCurrentUser() {
  const response = await apiRequest("GET", "/api/auth/me");
  return response.json();
}

export async function createInvitation(email: string, role: string) {
  const response = await apiRequest("POST", "/api/invitations", { email, role });
  return response.json();
}

export async function acceptInvitation(token: string, name: string, password: string) {
  const response = await apiRequest("POST", "/api/invitations/accept", { token, name, password });
  return response.json();
}
