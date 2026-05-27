'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ClipboardCheck, BarChart3, Settings, ShieldAlert, LogOut, User
} from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserName(localStorage.getItem('user_name'));
    }
  }, [pathname]);

  if (pathname === '/login') {
    return null;
  }

  const menuItems = [
    {
      name: 'Registro Asistencia',
      href: '/registro',
      icon: ClipboardCheck,
    },
    {
      name: 'Dashboard Realtime',
      href: '/dashboard',
      icon: BarChart3,
    },
    {
      name: 'Casos de Infraestructura',
      href: '/casos',
      icon: ShieldAlert,
    },
    {
      name: 'Administración',
      href: '/admin',
      icon: Settings,
    },
  ];

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    document.cookie = "session_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure";
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_name');
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="bg-[#111a2e] border-b border-[#1e2d4a] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#004e74] flex items-center justify-center text-[#60c0ea] font-bold shadow-md shadow-[#004e74]/20">
              S
            </div>
            <div>
              <span className="font-semibold text-lg text-white block leading-none">Sisprot Global Fiber</span>
              <span className="text-xs text-[#60c0ea] font-medium">Gestión del Encuentro</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-4 ml-auto md:ml-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-[#004e74] text-white shadow-md shadow-[#004e74]/30'
                        : 'text-gray-300 hover:bg-[#1a2640] hover:text-white'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#60c0ea]' : 'text-gray-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="h-4 w-[1px] bg-[#1e2d4a] hidden sm:block" />

            <div className="flex items-center gap-3">
              {userName && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 font-medium bg-[#0b111e] px-2.5 py-1 rounded-md border border-[#1e2d4a]">
                  <User className="h-3 w-3 text-[#60c0ea]" />
                  <span>{userName}</span>
                </div>
              )}
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 border border-transparent hover:border-red-500/20"
                title="Cerrar sesión"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

