// Cache application data only; credentials, downloads and operational status stay live.
export function readCacheTtl(path: string): number {
  if (!path.startsWith("/api/v1/") || /\/(uploads|scheduler|exports?|backup|health|cache-sync|oauth|callback|token|tokens|connect)(\/|$)|\/(pdf|download|export|status)(\/|$)/i.test(path)) return 0;
  if (/\/(settings|fee-plans|receiving-accounts)(\/|$)/.test(path)) return 120000;
  if (/\/(payments|invoices|receipts|cash-sessions|reports|dashboard)(\/|$)/.test(path)) return 15000;
  return 30000;
}
