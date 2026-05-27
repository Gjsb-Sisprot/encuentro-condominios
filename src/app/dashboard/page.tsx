'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { estaPresenteEnEvento } from '@/lib/utils';
import { 
  Users, UserCheck, Percent, BarChart3, 
  MapPin, RefreshCw, Layers, Pencil 
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
  parroquia?: string | null;
  asistio: boolean;
  es_acompanante: boolean;
  condominio: string;
  telefono: string;
  es_directivo: boolean;
  cargo_directivo: string | null;
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
  parroquia: string | null;
  asistio: boolean;
  es_acompanante: boolean | null;
  condominio: string;
  telefono: string;
  es_directivo: boolean | null;
  cargo_directivo: string | null;
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
   const [selectedMesaIdForDetail, setSelectedMesaIdForDetail] = useState<string | null>(null);
   const [filtro, setFiltro] = useState<'todos' | 'presidentes' | 'invitados'>('todos');
 
   const [editingAsistente, setEditingAsistente] = useState<AsistenteConMesa | null>(null);
   const [editingMesaIds, setEditingMesaIds] = useState<string[]>([]);
   const [savingMesa, setSavingMesa] = useState(false);
 
   const fetchData = async () => {
     try {
       setLoading(true);
       
       // Fetch all mesas
       const { data: dbMesas } = await supabase
         .from('mesas_trabajo')
         .select('*')
         .order('numero', { ascending: true });
       setMesas((dbMesas || []) as Mesa[]);
 
       // Fetch all assistants with check-in status, contact info, and their assigned tables through asistente_mesa
       const { data: dbAsistentes } = await supabase
         .from('asistentes')
         .select(`
           id, nombre, municipio, parroquia, asistio, es_acompanante, condominio, telefono, es_directivo, cargo_directivo,
           asistente_mesa (
             mesas_trabajo (id, numero, nombre)
           )
         `);
       
       const rawList = (dbAsistentes || []) as unknown as DbAsistenteJoin[];
       const formatted: AsistenteConMesa[] = rawList.map((item) => ({
         id: item.id,
         nombre: item.nombre,
         municipio: item.municipio,
         parroquia: item.parroquia,
         asistio: item.asistio,
         es_acompanante: item.es_acompanante || false,
         condominio: item.condominio,
         telefono: item.telefono,
         es_directivo: item.es_directivo || false,
         cargo_directivo: item.cargo_directivo,
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

   const handleSaveMesas = async () => {
     if (!editingAsistente) return;
     setSavingMesa(true);
     try {
       // Delete existing relations
       const { error: deleteError } = await supabase
         .from('asistente_mesa')
         .delete()
         .eq('asistente_id', editingAsistente.id);
       if (deleteError) throw deleteError;

       // Insert new relations
       if (editingMesaIds.length > 0) {
         const relations = editingMesaIds.map(mesaId => ({
           asistente_id: editingAsistente.id,
           mesa_id: mesaId
         }));
         const { error: insertError } = await supabase
           .from('asistente_mesa')
           .insert(relations);
         if (insertError) throw insertError;

         const { error: updateError } = await supabase
           .from('asistentes')
           .update({
             asistio: true,
             fecha_registro: new Date().toISOString(),
           })
           .eq('id', editingAsistente.id);
         if (updateError) throw updateError;
       }

       await fetchData();
       setEditingAsistente(null);
     } catch (err) {
       console.error('Error saving updated mesas:', err);
     } finally {
       setSavingMesa(false);
     }
   };
 
   useEffect(() => {
    fetchData();
    
    // Configurar canal de Supabase en tiempo real para asistentes
    const channelAsistentes = supabase
      .channel('asistentes-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asistentes' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Configurar canal de Supabase en tiempo real para asistente_mesa
    const channelAsistenteMesa = supabase
      .channel('asistente-mesa-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asistente_mesa' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelAsistentes);
      supabase.removeChannel(channelAsistenteMesa);
    };
  }, []);
 
   // Filter list based on selected category
   const asistentesFiltrados = asistentes.filter(a => {
     if (filtro === 'presidentes') return !a.es_acompanante;
     if (filtro === 'invitados') return a.es_acompanante;
     return true;
   });
 
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

  // Aggregate attendee data (presente = check-in digital o mesa asignada)
  asistentesFiltrados.forEach(a => {
    if (estaPresenteEnEvento(a)) {
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

  // Group global check-ins by municipality based on filtered set
  const municipioStats: { [municipio: string]: { total: number; asistieron: number } } = {};
  asistentesFiltrados.forEach(a => {
    const mun = a.municipio || 'No especificado';
    if (!municipioStats[mun]) {
      municipioStats[mun] = { total: 0, asistieron: 0 };
    }
    municipioStats[mun].total += 1;
    if (estaPresenteEnEvento(a)) {
      municipioStats[mun].asistieron += 1;
    }
  });

  // Group global check-ins by parroquia based on filtered set
  const parroquiaStats: { [parroquia: string]: { total: number; asistieron: number } } = {};
  asistentesFiltrados.forEach(a => {
    const parr = a.parroquia || 'No especificada';
    if (!parroquiaStats[parr]) {
      parroquiaStats[parr] = { total: 0, asistieron: 0 };
    }
    parroquiaStats[parr].total += 1;
    if (estaPresenteEnEvento(a)) {
      parroquiaStats[parr].asistieron += 1;
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
            Métricas de asistencia y desglose de quórum por mesa, municipio y parroquia en tiempo real.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
        </button>
      </div>

      {/* Selector de Filtros */}
      <div className="flex bg-[#111a2e] border border-[#1e2d4a] rounded-xl p-1 max-w-sm">
        <button
          onClick={() => {
            setFiltro('todos');
            setSelectedMesaIdForDetail(null);
          }}
          className={`flex-1 py-1.5 px-4 rounded-lg font-bold text-xs transition-all ${
            filtro === 'todos' 
              ? 'bg-[#f3af30] text-[#0b111e]' 
              : 'text-gray-400 hover:text-white hover:bg-[#1a2640]/50'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => {
            setFiltro('presidentes');
            setSelectedMesaIdForDetail(null);
          }}
          className={`flex-1 py-1.5 px-4 rounded-lg font-bold text-xs transition-all ${
            filtro === 'presidentes' 
              ? 'bg-[#60c0ea] text-[#0b111e]' 
              : 'text-gray-400 hover:text-white hover:bg-[#1a2640]/50'
          }`}
        >
          Presidentes
        </button>
        <button
          onClick={() => {
            setFiltro('invitados');
            setSelectedMesaIdForDetail(null);
          }}
          className={`flex-1 py-1.5 px-4 rounded-lg font-bold text-xs transition-all ${
            filtro === 'invitados' 
              ? 'bg-emerald-500 text-[#0b111e]' 
              : 'text-gray-400 hover:text-white hover:bg-[#1a2640]/50'
          }`}
        >
          Invitados
        </button>
      </div>

      {/* Tarjetas de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => {
            setFiltro('presidentes');
            setSelectedMesaIdForDetail(null);
          }}
          className={`bg-[#111a2e] border rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            filtro === 'presidentes' 
              ? 'border-[#60c0ea] ring-1 ring-[#60c0ea] shadow-[0_0_15px_rgba(96,192,234,0.15)]' 
              : 'border-[#1e2d4a] opacity-70 hover:opacity-100'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Presidentes</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">
                {asistentes.filter(a => !a.es_acompanante && estaPresenteEnEvento(a)).length}
              </span>
              <span className="text-sm text-gray-400">
                de {asistentes.filter(a => !a.es_acompanante).length}
              </span>
            </div>
            <span className="text-xs text-gray-500 block">Presidentes con mesa asignada o check-in</span>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
            filtro === 'presidentes' ? 'bg-[#004e74] text-white' : 'bg-[#004e74]/20 text-[#60c0ea]'
          }`}>
            <Users className="h-6 w-6" />
          </div>
        </div>
 
        <div 
          onClick={() => {
            setFiltro('invitados');
            setSelectedMesaIdForDetail(null);
          }}
          className={`bg-[#111a2e] border rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            filtro === 'invitados' 
              ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
              : 'border-[#1e2d4a] opacity-70 hover:opacity-100'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Invitados</span>
            <span className="text-4xl font-extrabold text-emerald-400">
              {asistentes.filter(a => a.es_acompanante && estaPresenteEnEvento(a)).length}
            </span>
            <span className="text-xs text-gray-500 block">Acompañantes con mesa asignada o check-in</span>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
            filtro === 'invitados' ? 'bg-emerald-600 text-white' : 'bg-emerald-950/20 text-emerald-400'
          }`}>
            <UserCheck className="h-6 w-6" />
          </div>
        </div>
 
        <div 
          onClick={() => {
            setFiltro('todos');
            setSelectedMesaIdForDetail(null);
          }}
          className={`bg-[#111a2e] border rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            filtro === 'todos' 
              ? 'border-[#f3af30] ring-1 ring-[#f3af30] shadow-[0_0_15px_rgba(243,175,48,0.15)]' 
              : 'border-[#1e2d4a] opacity-70 hover:opacity-100'
          }`}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Totales por todo</span>
            <span className="text-4xl font-extrabold text-[#f3af30]">
              {asistentes.filter(a => estaPresenteEnEvento(a)).length}
            </span>
            <span className="text-xs text-gray-500 block">Personas con mesa asignada o check-in</span>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
            filtro === 'todos' ? 'bg-[#f3af30] text-black' : 'bg-amber-950/20 text-[#f3af30]'
          }`}>
            <Percent className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Gráficos de mesas de trabajo y municipios/parroquias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel Izquierdo: Quórum de Asistencia por Mesa */}
        <div className="lg:col-span-2 bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
              <Layers className="h-5 w-5 text-[#60c0ea]" /> Distribución de Asistentes por Mesa
            </h2>
            <p className="text-xs text-gray-400 mt-2">
              Haz clic en cualquier mesa de trabajo para ver el listado detallado de asistentes abajo.
            </p>
          </div>

          <div className="space-y-4">
            {mesaStatsList.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No hay mesas de trabajo creadas en la base de datos.
              </div>
            ) : (
              mesaStatsList.map(mesa => {
                const maxCap = Math.max(...mesaStatsList.map(m => m.totalAsistieron), 10);
                const percentBar = Math.round((mesa.totalAsistieron / maxCap) * 100);
                const isSelected = selectedMesaIdForDetail === mesa.id;
                
                return (
                  <div 
                    key={mesa.id} 
                    onClick={() => setSelectedMesaIdForDetail(isSelected ? null : mesa.id)}
                    className={`space-y-2 cursor-pointer p-3 rounded-xl transition-all border ${
                      isSelected 
                        ? 'bg-[#1a2640]/80 border-[#60c0ea]/60 shadow-lg shadow-[#004e74]/10' 
                        : 'bg-transparent border-transparent hover:bg-[#1a2640]/40 hover:border-[#1e2d4a]'
                    }`}
                  >
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

        {/* Panel Derecho: Estadísticas por Territorio (Municipio y Parroquia) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Asistencia por Municipio */}
          <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
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

          {/* Asistencia por Parroquia */}
          <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
              <MapPin className="h-5 w-5 text-[#60c0ea]" /> Asistencia por Parroquia
            </h2>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {Object.keys(parroquiaStats).length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  No hay registros de parroquias cargados.
                </div>
              ) : (
                Object.entries(parroquiaStats)
                  .sort((a, b) => b[1].asistieron - a[1].asistieron)
                  .map(([parr, stat]) => {
                    const percentAsis = stat.total > 0 
                      ? Math.round((stat.asistieron / stat.total) * 100) 
                      : 0;
                    return (
                      <div key={parr} className="p-3 bg-[#0b111e] rounded-xl border border-[#1e2d4a] space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-xs truncate max-w-[170px]" title={parr}>{parr}</span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {stat.asistieron} / {stat.total} asistieron
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-[#1a2640] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#60c0ea] rounded-full"
                              style={{ width: `${percentAsis}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-bold text-[#60c0ea] shrink-0">{percentAsis}%</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Detalle de Asistentes por Mesa seleccionada */}
      {selectedMesaIdForDetail && (
        (() => {
          const selectedMesa = mesas.find(m => m.id === selectedMesaIdForDetail);
          const detailList = asistentesFiltrados.filter(
            a => estaPresenteEnEvento(a) && a.mesas_asignadas.some(m => m.id === selectedMesaIdForDetail)
          );
          
          return selectedMesa ? (
            <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-4 animate-slide-up">
              <div className="flex justify-between items-center border-b border-[#1e2d4a] pb-3">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#60c0ea]" /> Asistentes de la {selectedMesa.nombre}
                  </h2>
                  <p className="text-gray-400 text-xs mt-1">
                    Listado completo de personas registradas que participan en esta mesa.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMesaIdForDetail(null)}
                  className="text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-[#1a2640] border border-[#1e2d4a] transition-all"
                >
                  Cerrar Detalle
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2d4a] text-gray-400">
                      <th className="py-2.5 px-2">Nombre</th>
                      <th className="py-2.5 px-2">Perfil</th>
                      <th className="py-2.5 px-2">Condominio</th>
                      <th className="py-2.5 px-2">Municipio</th>
                      <th className="py-2.5 px-2">Teléfono</th>
                      <th className="py-2.5 px-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2d4a]">
                    {detailList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No hay ningún asistente registrado en esta mesa de trabajo.
                        </td>
                      </tr>
                    ) : (
                      detailList.map(a => (
                        <tr key={a.id} className="hover:bg-[#15223e] transition-colors">
                          <td className="py-3 px-2 font-medium text-white">{a.nombre}</td>
                          <td className="py-3 px-2">
                            {a.es_acompanante ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-950/40 text-amber-400 border border-amber-900/60" title={a.es_directivo ? `Directivo: ${a.cargo_directivo}` : 'Acompañante'}>
                                Acompañante {a.es_directivo && `(${a.cargo_directivo})`}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#004e74]/20 text-[#60c0ea] border border-[#004e74]/40">
                                Presidente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-gray-300 max-w-[200px] truncate">{a.condominio}</td>
                          <td className="py-3 px-2 text-gray-300">{a.municipio}</td>
                          <td className="py-3 px-2 font-mono text-gray-300">{a.telefono}</td>
                          <td className="py-3 px-2 text-right">
                            <button
                              onClick={() => {
                                setEditingAsistente(a);
                                setEditingMesaIds(a.mesas_asignadas.map(m => m.id));
                              }}
                              className="p-1.5 rounded bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white hover:bg-[#1e2d4a] transition-all"
                              title="Editar mesas asignadas"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null;
        })()
      )}

      {/* Modal para editar mesas de un asistente */}
      {editingAsistente && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div>
              <h3 className="text-lg font-bold text-white">Editar Mesas Asignadas</h3>
              <p className="text-xs text-gray-400 mt-1">
                Modifica las mesas de trabajo para <strong>{editingAsistente.nombre}</strong>.
              </p>
            </div>

            <div className="space-y-2 bg-[#1a2640] p-4 rounded-xl border border-[#1e2d4a] max-h-60 overflow-y-auto">
              {mesas.map(m => {
                const isChecked = editingMesaIds.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-3 text-sm text-gray-300 hover:text-white cursor-pointer py-1.5 px-2 rounded hover:bg-[#111a2e] transition-colors">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setEditingMesaIds(editingMesaIds.filter(id => id !== m.id));
                        } else {
                          setEditingMesaIds([...editingMesaIds, m.id]);
                        }
                      }}
                      className="rounded border-[#1e2d4a] bg-[#111a2e] text-[#60c0ea] focus:ring-0 focus:ring-offset-0"
                    />
                    <span>{m.nombre}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={savingMesa}
                onClick={() => setEditingAsistente(null)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-all text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingMesa}
                onClick={handleSaveMesas}
                className="flex-1 py-2 bg-[#004e74] hover:bg-[#004e74]/80 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
              >
                {savingMesa ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
