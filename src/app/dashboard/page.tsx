'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, UserCheck, Percent, BarChart3, 
  MapPin, RefreshCw, Layers 
} from 'lucide-react';

interface Mesa {
  id: string;
  numero: number;
  nombre: string;
}

interface AsistenteConMesa {
  id: string;
  nombre: string;
  municipio: string;
  asistio: boolean;
  es_acompanante: boolean;
  mesas_asignadas: {
    id: string;
    numero: number;
    nombre: string;
  }[];
}

interface DbAsistenteJoin {
  id: string;
  nombre: string;
  municipio: string;
  asistio: boolean;
  es_acompanante: boolean | null;
  asistente_mesa: {
    mesas_trabajo: {
      id: string;
      numero: number;
      nombre: string;
    } | null;
  }[];
}

interface MesaStats {
  id: string;
  numero: number;
  nombre: string;
  totalAsistieron: number;
  totalPresidentes: number;
  totalAcompanantes: number;
  porMunicipio: { [municipio: string]: number };
}

export default function DashboardPage() {
  const [asistentes, setAsistentes] = useState<AsistenteConMesa[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all mesas
      const { data: dbMesas } = await supabase
        .from('mesas_trabajo')
        .select('*')
        .order('numero', { ascending: true });
      setMesas((dbMesas || []) as Mesa[]);

      // Fetch all assistants with check-in status and their assigned tables through asistente_mesa
      const { data: dbAsistentes } = await supabase
        .from('asistentes')
        .select(`
          id, nombre, municipio, asistio, es_acompanante,
          asistente_mesa (
            mesas_trabajo (id, numero, nombre)
          )
        `);
      
      const rawList = (dbAsistentes || []) as unknown as DbAsistenteJoin[];
      const formatted: AsistenteConMesa[] = rawList.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        municipio: item.municipio,
        asistio: item.asistio,
        es_acompanante: item.es_acompanante || false,
        mesas_asignadas: (item.asistente_mesa || [])
          .map(am => am.mesas_trabajo)
          .filter((m): m is { id: string; numero: number; nombre: string } => m !== null)
      }));

      setAsistentes(formatted);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Configurar canal de Supabase en tiempo real para actualizaciones inmediatas
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asistentes' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Aggregations
  // Let's define total official guests (presidents) pre-registered:
  const totalInvitados = asistentes.filter(a => !a.es_acompanante).length;
  // Total people who checked-in
  const totalAsistieron = asistentes.filter(a => a.asistio).length;
  // Percentage calculated against registered presidents
  const porcentajeAsistencia = totalInvitados > 0 
    ? Math.round((asistentes.filter(a => !a.es_acompanante && a.asistio).length / totalInvitados) * 100) 
    : 0;

  // Group stats by work table (mesa)
  const mesaStatsMap: { [mesaId: string]: MesaStats } = {};
  
  // Initialize with all existing tables
  mesas.forEach(m => {
    mesaStatsMap[m.id] = {
      id: m.id,
      numero: m.numero,
      nombre: m.nombre,
      totalAsistieron: 0,
      totalPresidentes: 0,
      totalAcompanantes: 0,
      porMunicipio: {}
    };
  });

  // Aggregate attendee data
  asistentes.forEach(a => {
    if (a.asistio) {
      a.mesas_asignadas.forEach(m => {
        if (mesaStatsMap[m.id]) {
          const stats = mesaStatsMap[m.id];
          stats.totalAsistieron += 1;
          if (a.es_acompanante) {
            stats.totalAcompanantes += 1;
          } else {
            stats.totalPresidentes += 1;
          }
          
          const mun = a.municipio || 'No especificado';
          stats.porMunicipio[mun] = (stats.porMunicipio[mun] || 0) + 1;
        }
      });
    }
  });

  const mesaStatsList = Object.values(mesaStatsMap).sort((a, b) => a.numero - b.numero);

  // Group global check-ins by municipality
  const municipioStats: { [municipio: string]: { total: number; asistieron: number } } = {};
  asistentes.forEach(a => {
    // Only count registered presidents for municipal percentages or all? Let's count presidents as total base
    const mun = a.municipio || 'No especificado';
    if (!municipioStats[mun]) {
      municipioStats[mun] = { total: 0, asistieron: 0 };
    }
    if (!a.es_acompanante) {
      municipioStats[mun].total += 1;
    }
    if (a.asistio) {
      municipioStats[mun].asistieron += 1;
    }
  });

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Encabezado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-[#60c0ea]" /> Dashboard Estadístico
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Métricas de asistencia y desglose de quórum por mesa y por municipio en tiempo real.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
        </button>
      </div>

      {/* Tarjetas de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Invitados</span>
            <span className="text-4xl font-extrabold text-white">{totalInvitados}</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-[#1a2640] text-gray-300 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Asistentes Registrados</span>
            <span className="text-4xl font-extrabold text-emerald-400">{totalAsistieron}</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-950/20 text-emerald-400 flex items-center justify-center">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Porcentaje Asistencia</span>
            <span className="text-4xl font-extrabold text-[#60c0ea]">{porcentajeAsistencia}%</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-[#004e74]/20 text-[#60c0ea] flex items-center justify-center">
            <Percent className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Gráficos de mesas de trabajo y municipios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel Izquierdo: Quórum de Asistencia por Mesa */}
        <div className="lg:col-span-2 bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
            <Layers className="h-5 w-5 text-[#60c0ea]" /> Distribución de Asistentes por Mesa
          </h2>

          <div className="space-y-6">
            {mesaStatsList.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No hay mesas de trabajo creadas en la base de datos.
              </div>
            ) : (
              mesaStatsList.map(mesa => {
                const maxCap = Math.max(...mesaStatsList.map(m => m.totalAsistieron), 10);
                const percentBar = Math.round((mesa.totalAsistieron / maxCap) * 100);
                
                return (
                  <div key={mesa.id} className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white block">Mesa {mesa.numero}</span>
                        <span className="text-xs text-gray-400">{mesa.nombre}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-3 py-1 rounded-full bg-[#004e74]/20 border border-[#004e74]/40 text-xs font-bold text-[#60c0ea]">
                          {mesa.totalAsistieron} Asistentes
                        </span>
                        <div className="flex gap-2 text-[10px] font-semibold">
                          <span className="text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/40">
                            Presidentes: {mesa.totalPresidentes}
                          </span>
                          <span className="text-amber-400 bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-900/40">
                            Invitados: {mesa.totalAcompanantes}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="h-2.5 w-full bg-[#1a2640] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#004e74] to-[#60c0ea] rounded-full transition-all duration-500"
                        style={{ width: `${percentBar}%` }}
                      ></div>
                    </div>

                    {/* Desglose por municipio por mesa */}
                    {mesa.totalAsistieron > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 mr-1">Procedencia:</span>
                        {Object.entries(mesa.porMunicipio).map(([muni, count]) => (
                          <span key={muni} className="px-2 py-0.5 text-[10px] rounded bg-[#1a2640] text-gray-300 border border-[#1e2d4a]">
                            {muni}: <strong className="text-white">{count}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel Derecho: Estadísticas por Municipio */}
        <div className="lg:col-span-1 bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
            <MapPin className="h-5 w-5 text-[#f3af30]" /> Asistencia por Municipio
          </h2>

          <div className="space-y-4">
            {Object.keys(municipioStats).length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No hay registros de municipios cargados.
              </div>
            ) : (
              Object.entries(municipioStats).map(([muni, stat]) => {
                const percentAsis = stat.total > 0 
                  ? Math.round((stat.asistieron / stat.total) * 100) 
                  : 0;
                return (
                  <div key={muni} className="p-4 bg-[#0b111e] rounded-xl border border-[#1e2d4a] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{muni}</span>
                      <span className="text-xs text-gray-400 font-medium">
                        {stat.asistieron} / {stat.total} asistieron
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-[#1a2640] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#f3af30] rounded-full"
                          style={{ width: `${percentAsis}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-[#f3af30] shrink-0">{percentAsis}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
