/** Display format: CODE/DC/01 */
export function formatChallanNo(code, challanNo) {
  const n = Number(challanNo);
  if (!Number.isFinite(n) || n <= 0) {
    return code ? `${String(code).toUpperCase()}/DC/…` : '—';
  }
  const padded = String(n).padStart(2, '0');
  const c = String(code || '').trim().toUpperCase();
  return c ? `${c}/DC/${padded}` : padded;
}
