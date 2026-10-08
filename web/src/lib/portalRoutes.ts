import type { Role } from "@prisma/client";

export function dashboardForRole(role: Role): string {
  switch (role) {
    case "OWNER": return "/admin/dashboard";
    case "RECEPTIONIST": return "/admin/reception/dashboard";
    case "TRAINER": return "/admin/trainer/dashboard";
    case "MEMBER": return "/dashboard";
    default: return "/login";
  }
}

export function loginForRole(role: Role): string {
  return role === "MEMBER" ? "/login" : "/admin/login";
}
