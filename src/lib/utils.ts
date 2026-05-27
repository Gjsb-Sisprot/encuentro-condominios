export function cleanCedula(cedula: string): string {
  if (!cedula) return '';
  // Remove spaces, dots, dashes
  const clean = cedula.replace(/[\s\.\-]/g, '').toUpperCase();
  // If it starts with 'V', 'E', 'J', or 'G', format it as 'V-XXXXX' etc.
  if (clean.startsWith('V') || clean.startsWith('E') || clean.startsWith('J') || clean.startsWith('G')) {
    return `${clean[0]}-${clean.slice(1)}`;
  }
  // Otherwise, if it's only digits, default to V-
  if (/^\d+$/.test(clean)) {
    return `V-${clean}`;
  }
  return clean;
}

export function cleanTelefono(telefono: string): string {
  if (!telefono) return '';
  // Keep only digits
  let clean = telefono.replace(/\D/g, '');
  // If it starts with '0', replace with '58'
  if (clean.startsWith('0')) {
    clean = '58' + clean.slice(1);
  }
  // If it doesn't start with 58 and is 10 digits (like 4141234567), prepend 58
  if (!clean.startsWith('58') && clean.length === 10) {
    clean = '58' + clean;
  }
  return clean;
}
