'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { setSessionActive } from '@/lib/utils';
import { 
  ClipboardCheck, BarChart3, Settings, ShieldAlert, LogOut, User, Users, Calendar
} from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [jornadas, setJornadas] = useState<string[]>([]);
  const [activeJornada, setActiveJornada] = useState<string>('');

  // Fetch unique jornadas from DB
  async function fetchJornadas() {
    try {
      const { data, error } = await supabase
        .from('asistentes')
        .select('estado');
      
      if (error) throw error;
      
      if (data) {
        const uniqueJorns = Array.from(new Set(
          data.map(item => {
            const parts = (item.estado || '').split('|');
            return parts[1] || 'Jornada General';
          })
        )).sort();
        setJornadas(uniqueJorns);

        // Set default active jornada if not set
        const saved = localStorage.getItem('active_jornada');
        if (saved && uniqueJorns.includes(saved)) {
          setActiveJornada(saved);
        } else if (uniqueJorns.length > 0) {
          const defaultJornada = uniqueJorns[uniqueJorns.length - 1]; // Latest
          setActiveJornada(defaultJornada);
          localStorage.setItem('active_jornada', defaultJornada);
          window.dispatchEvent(new CustomEvent('jornadaChanged', { detail: defaultJornada }));
        } else {
          setActiveJornada('Jornada General');
          localStorage.setItem('active_jornada', 'Jornada General');
        }
      }
    } catch (err) {
      console.error('Error fetching jornadas:', err);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserName(localStorage.getItem('user_name'));
    }
    fetchJornadas();

    // Subscribe to changes in asistentes to reload jornadas list if new ones are added
    const channel = supabase
      .channel('navigation-asistentes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asistentes' },
        () => {
          fetchJornadas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  const handleJornadaChange = (value: string) => {
    setActiveJornada(value);
    localStorage.setItem('active_jornada', value);
    window.dispatchEvent(new CustomEvent('jornadaChanged', { detail: value }));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    setSessionActive(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_name');
    }
    router.push('/login');
    router.refresh();
  };

  const menuItems = [
    {
      name: 'Registro Asistencia',
      href: '/registro',
      icon: ClipboardCheck,
    },
    {
      name: 'Lista del Moderador',
      href: '/moderador',
      icon: Users,
    },
    {
      name: 'Jornadas',
      href: '/jornadas',
      icon: Calendar,
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
            {/* Jornada Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#0b111e] px-2.5 py-1.5 rounded-lg border border-[#1e2d4a]">
              <Calendar className="h-3.5 w-3.5 text-[#60c0ea]" />
              <select
                value={activeJornada}
                onChange={e => handleJornadaChange(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer uppercase pr-2"
              >
                {jornadas.length === 0 ? (
                  <option value="Jornada General" className="bg-[#111a2e] text-white">JORNADA GENERAL</option>
                ) : (
                  jornadas.map(j => (
                    <option key={j} value={j} className="bg-[#111a2e] text-white">{j.toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>

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
