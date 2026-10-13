export type User = { id: string; name: string; email: string | null; memberId: string | null; role: string; mustChangePassword: boolean; permissions?: Record<string, boolean> };
export type Exercise = { id: string; name: string; type: string; sets: number | null; reps: string | null; restSeconds: number | null; instructions: string | null; demoVideoUrl: string | null };
export type Dashboard = {
  isSetupPending: boolean;
  user?: { name: string };
  member?: { id: string; fullName: string; memberId: string; email: string | null; phone: string };
  membership: { id: string; planName: string; status: string; startDate: string; endDate: string; daysRemaining: number; price: number } | null;
  feeSummary: { outstanding: number; overdue: number; upcomingInstallments: number; advanceBalance?: number };
  todayWorkout: { planId: string; dayId: string; planTitle: string; dayTitle: string; exercises: Exercise[]; session: { id: string; status: string } | null } | null;
  availablePlans?: { id: string; name: string; membershipFee: number }[];
  freezePolicy?: { maxDays: number };
  receivingAccounts?: { id: string; displayName: string; accountTitle?: string; bankName?: string; accountNumber?: string; iban?: string }[];
  trainer: { name: string; coachingFocus: string; isReassignmentPending: boolean } | null;
  announcements: { id: string; title: string; content: string; createdAt: string }[];
};
