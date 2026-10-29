export function getCompanyProfile() {
  return {
    name: process.env.COMPANY_NAME || 'SRI MEENAKSHI INDUSTRIES',
    address: process.env.COMPANY_ADDRESS || 'Plot No. 297, 4th Main Road, Burma Colony, Perungudi, Chennai - 600 096.',
    cell: process.env.COMPANY_CELL || '94440 88604',
    email: process.env.COMPANY_EMAIL || 'srimeenakshiindustries001@gmail.com',
    web: process.env.COMPANY_WEB || 'srimeenakshigroups.in',
    gstin: process.env.COMPANY_GSTIN || '33IXGPS8286H1ZP',
  };
}

export function formatDisplayDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}
