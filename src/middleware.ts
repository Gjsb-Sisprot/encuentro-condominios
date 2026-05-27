import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionActive = request.cookies.get('session_active')?.value;
  const { pathname } = request.nextUrl;

  // Permite solicitudes a login, archivos estáticos internos, favicons y APIs sin verificar sesión
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Si no tiene la cookie activa, redirige a /login
  if (!sessionActive || sessionActive !== 'true') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Ejecutar middleware en todas las rutas excepto recursos estáticos habituales
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
