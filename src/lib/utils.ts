interface AsistentePresencia {
  asistio: boolean;
  mesas_asignadas?: { id: string }[];
}

/** Presente si hizo check-in digital o tiene al menos una mesa asignada en el evento. */
export function estaPresenteEnEvento(asistente: AsistentePresencia): boolean {
  return asistente.asistio || (asistente.mesas_asignadas?.length ?? 0) > 0;
}

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

function getSessionCookieSuffix(): string {
  if (typeof window === 'undefined') return '';
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

export function setSessionActive(active: boolean): void {
  if (typeof document === 'undefined') return;

  const suffix = getSessionCookieSuffix();

  if (active) {
    document.cookie = `session_active=true; path=/; max-age=86400; SameSite=Lax${suffix}`;
    return;
  }

  document.cookie = `session_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${suffix}`;
}

export function hasActiveSession(): boolean {
  if (typeof document === 'undefined') return false;

  const sessionCookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith('session_active='));

  return sessionCookie?.split('=')[1] === 'true';
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
