'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, Award, Star, Search, Check, 
  X, Loader2, ArrowRight, CheckCircle2, XCircle 
} from 'lucide-react';

interface DbMesaResponse {
  id: string;
  numero: number;
  nombre: string;
}

interface AsistenteInfo {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string;
  condominio: string;
  municipio: string;
  parroquia: string | null;
  asistio: boolean;
  estado: string | null;
  es_acompanante: boolean;
  es_directivo: boolean;
  cargo_directivo: string | null;
  mesas_asignadas: string[];
}

export default function ModeradorPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [mesas, setMesas] = useState<DbMesaResponse[]>([]);
  const [asistentes, setAsistentes] = useState<AsistenteInfo[]>([]);
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);
  const [activeJornada, setActiveJornada] = useState<string>('Jornada General');
  
  // Search state for moderator selection
  const [modSearchQuery, setModSearchQuery] = useState('');
  const [showModDropdown, setShowModDropdown] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('active_jornada') || 'Jornada General';
      setActiveJornada(saved);
    }

    const onJornadaChanged = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setActiveJornada(customEvent.detail);
    };

    window.addEventListener('jornadaChanged', onJornadaChanged);
    return () => {
      window.removeEventListener('jornadaChanged', onJornadaChanged);
    };
  }, []);

  // Fetch data from database
  async function fetchData() {
    try {
      // Fetch mesas
      const { data: mesasData, error: mesasErr } = await supabase
        .from('mesas_trabajo')
        .select('*')
        .order('numero', { ascending: true });

      if (mesasErr) throw mesasErr;
      if (mesasData) setMesas(mesasData);

      // Fetch assistants and join with assistant_mesa
      let query = supabase
        .from('asistentes')
        .select(`
          id, nombre, cedula, telefono, condominio, municipio, parroquia, asistio, estado,
          es_acompanante, es_directivo, cargo_directivo,
          asistente_mesa ( mesa_id )
        `);

      if (activeJornada) {
        if (activeJornada === 'Jornada General') {
          query = query.or('estado.is.null,estado.not.ilike.%|%,estado.ilike.%|Jornada General');
        } else {
          query = query.ilike('estado', `%|${activeJornada}`);
        }
      }

      const { data: astData, error: astErr } = await query;

      if (astErr) throw astErr;

      if (astData) {
        const formattedAst: AsistenteInfo[] = (astData as unknown as {
          id: string;
          nombre: string;
          cedula: string;
          telefono: string;
          condominio: string;
          municipio: string;
          parroquia: string | null;
          asistio: boolean;
          estado: string | null;
          es_acompanante: boolean | null;
          es_directivo: boolean | null;
          cargo_directivo: string | null;
          asistente_mesa: { mesa_id: string }[] | null;
        }[]).map(item => ({
          id: item.id,
          nombre: item.nombre,
          cedula: item.cedula,
          telefono: item.telefono,
          condominio: item.condominio,
          municipio: item.municipio,
          parroquia: item.parroquia,
          asistio: item.asistio,
          estado: item.estado,
          es_acompanante: item.es_acompanante || false,
          es_directivo: item.es_directivo || false,
          cargo_directivo: item.cargo_directivo,
          mesas_asignadas: (item.asistente_mesa || []).map(am => am.mesa_id)
        }));
        setAsistentes(formattedAst);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();

    // Setup real-time updates for both tables
    const channelAsistentes = supabase
      .channel('moderador-asistentes-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asistentes' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const channelAsistenteMesa = supabase
      .channel('moderador-asistente-mesa-db-changes')
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
  }, [activeJornada]);

  // Find moderator for a given mesa ID
  const getModeratorForMesa = (mesaId: string): AsistenteInfo | undefined => {
    return asistentes.find(a => (a.estado || '').split('|')[0] === `MODERADOR_MESA_${mesaId}`);
  };

  // Assign moderator to selected mesa
  const handleAssignModerator = async (astId: string) => {
    if (!selectedMesaId) return;
    setActionLoading(true);
    try {
      // 1. Clear previous moderator for this mesa
      const prevMod = getModeratorForMesa(selectedMesaId);
      if (prevMod) {
        await supabase
          .from('asistentes')
          .update({ estado: `|${activeJornada}` })
          .eq('id', prevMod.id);
      }

      // 2. Set new moderator
      await supabase
        .from('asistentes')
        .update({ estado: `MODERADOR_MESA_${selectedMesaId}|${activeJornada}` })
        .eq('id', astId);

      setModSearchQuery('');
      setShowModDropdown(false);
      await fetchData();
    } catch (err) {
      console.error('Error assigning moderator:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove moderator from selected mesa
  const handleRemoveModerator = async (astId: string) => {
    setActionLoading(true);
    try {
      await supabase
        .from('asistentes')
        .update({ estado: `|${activeJornada}` })
        .eq('id', astId);
      await fetchData();
    } catch (err) {
      console.error('Error removing moderator:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle verified attendance
  const handleToggleVerification = async (ast: AsistenteInfo) => {
    if (!selectedMesaId) return;
    const astStatus = (ast.estado || '').split('|')[0];
    const isCurrentlyVerified = astStatus === 'VERIFICADO' || astStatus === `MODERADOR_MESA_${selectedMesaId}`;
    
    // Moderators are always verified, don't allow modifying verification directly unless moderator status changes
    if (astStatus === `MODERADOR_MESA_${selectedMesaId}`) return;

    setActionLoading(true);
    try {
      const nextEstado = isCurrentlyVerified ? `|${activeJornada}` : `VERIFICADO|${activeJornada}`;
      await supabase
        .from('asistentes')
        .update({ estado: nextEstado })
        .eq('id', ast.id);
      await fetchData();
    } catch (err) {
      console.error('Error updating verification status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Selected mesa details
  const selectedMesa = mesas.find(m => m.id === selectedMesaId);
  const assistantsInSelectedMesa = selectedMesaId 
    ? asistentes.filter(a => a.mesas_asignadas.includes(selectedMesaId))
    : [];

  // Metrics for selected mesa
  // Assumed arrived if asistio is true
  const totalArrived = assistantsInSelectedMesa.filter(a => a.asistio).length;
  const totalStayed = assistantsInSelectedMesa.filter(
    a => {
      const statusPart = (a.estado || '').split('|')[0];
      return a.asistio && (statusPart === 'VERIFICADO' || statusPart === `MODERADOR_MESA_${selectedMesaId}`);
    }
  ).length;
  const totalLeft = totalArrived - totalStayed;
  const retentionRate = totalArrived > 0 ? Math.round((totalStayed / totalArrived) * 100) : 0;

  // Filter list of prospective moderators
  const prospectiveModerators = modSearchQuery.trim() === '' 
    ? [] 
    : asistentes.filter(a => 
        (a.nombre.toLowerCase().includes(modSearchQuery.toLowerCase()) || 
         a.cedula.includes(modSearchQuery)) &&
        !a.estado?.startsWith('MODERADOR_MESA_') // exclude other moderators
      );

  return (
    <main className="min-h-screen bg-[#0b111e] text-white p-4 md:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-[#1e2d4a] pb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#60c0ea] to-[#004e74] flex items-center justify-center text-[#111a2e] shadow-lg shadow-[#60c0ea]/10">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight uppercase">Lista del Moderador</h1>
              <p className="text-gray-400 text-sm">
                Designa los moderadores de las mesas de trabajo y verifica la asistencia presencial de los participantes.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#60c0ea] animate-spin" />
            <p className="text-gray-400 text-sm font-medium">Cargando módulo del moderador...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left side: Mesas List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-5 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-4 uppercase flex items-center gap-2">
                  <Award className="h-5 w-5 text-[#60c0ea]" /> Mesas de Trabajo
                </h2>
                
                <div className="space-y-3">
                  {mesas.map((m) => {
                    const active = selectedMesaId === m.id;
                    const moderator = getModeratorForMesa(m.id);
                    const mesaAsts = asistentes.filter(a => a.mesas_asignadas.includes(m.id));
                    const arrived = mesaAsts.filter(a => a.asistio).length;
                    const verified = mesaAsts.filter(
                      a => a.asistio && (a.estado === 'VERIFICADO' || a.estado === `MODERADOR_MESA_${m.id}`)
                    ).length;

                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMesaId(m.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden ${
                          active 
                            ? 'bg-[#1a2640] border-[#60c0ea] shadow-md shadow-[#60c0ea]/5' 
                            : 'bg-[#121c33] border-[#1e2d4a] hover:border-gray-600'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 relative z-10">
                          <div>
                            <span className="text-[10px] font-bold text-[#60c0ea] uppercase tracking-wider block mb-1">
                              MESA {m.numero}
                            </span>
                            <h3 className="font-bold text-white text-sm group-hover:text-[#60c0ea] transition-colors uppercase">
                              {m.nombre.replace(/Mesa \d+:\s*/i, '')}
                            </h3>
                            
                            <div className="mt-3 flex items-center gap-1.5 text-xs">
                              <Star className={`h-3.5 w-3.5 ${moderator ? 'text-amber-400 fill-amber-400' : 'text-gray-500'}`} />
                              <span className={moderator ? 'text-amber-200 font-semibold uppercase' : 'text-gray-400 font-light italic'}>
                                {moderator ? moderator.nombre : 'Sin moderador asignado'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-semibold text-gray-400 block uppercase">
                              Permanencia
                            </span>
                            <span className="text-sm font-bold text-white block mt-1">
                              {verified} <span className="text-gray-400 font-normal">/ {arrived}</span>
                            </span>
                          </div>
                        </div>

                        {active && (
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#60c0ea]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right side: Mesa details & Attendance verify */}
            <div className="lg:col-span-8">
              {selectedMesa ? (
                <div className="space-y-6">
                  
                  {/* Mesa Detail Card */}
                  <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 shadow-xl space-y-6">
                    
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2d4a] pb-5">
                      <div>
                        <span className="text-xs font-bold text-[#60c0ea] uppercase tracking-wider">
                          DETALLE Y MODERACIÓN
                        </span>
                        <h2 className="text-xl font-bold text-white uppercase mt-1">
                          {selectedMesa.nombre}
                        </h2>
                      </div>

                      {/* Moderator control */}
                      <div className="flex items-center gap-3">
                        {getModeratorForMesa(selectedMesa.id) ? (
                          <div className="bg-[#18233c] border border-amber-500/20 px-3.5 py-2 rounded-xl flex items-center gap-3 shadow-lg">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <Star className="h-4.5 w-4.5 text-amber-400 fill-amber-400" />
                            </div>
                            <div className="text-left">
                              <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider block">
                                MODERADOR
                              </span>
                              <span className="text-xs font-bold text-white block uppercase">
                                {getModeratorForMesa(selectedMesa.id)?.nombre}
                              </span>
                            </div>
                            <button
                              disabled={actionLoading}
                              onClick={() => handleRemoveModerator(getModeratorForMesa(selectedMesa.id)!.id)}
                              className="text-gray-400 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all ml-1"
                              title="Quitar moderador"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          // Selector Input dropdown for prospective moderator
                          <div className="relative w-64">
                            <div className="relative">
                              <input
                                type="text"
                                value={modSearchQuery}
                                onFocus={() => setShowModDropdown(true)}
                                onBlur={() => setTimeout(() => setShowModDropdown(false), 250)}
                                onChange={e => setModSearchQuery(e.target.value)}
                                placeholder="ASIGNAR MODERADOR..."
                                className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#60c0ea] placeholder-gray-500 uppercase font-semibold"
                              />
                              <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-gray-400" />
                            </div>
                            
                            {showModDropdown && modSearchQuery.trim() !== '' && (
                              <div className="absolute z-50 right-0 w-72 mt-1 max-h-60 overflow-y-auto bg-[#162035] border border-[#1e2d4a] rounded-xl shadow-2xl">
                                {prospectiveModerators.map(a => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => handleAssignModerator(a.id)}
                                    className="w-full text-left px-4 py-2.5 text-xs text-gray-200 hover:bg-[#60c0ea] hover:text-[#111a2e] border-b border-[#1e2d4a]/50 last:border-b-0 uppercase transition-all flex flex-col gap-0.5"
                                  >
                                    <span className="font-bold">{a.nombre.toUpperCase()}</span>
                                    <span className="text-[10px] text-gray-400 group-hover:text-inherit">
                                      C.I. {a.cedula} | {a.condominio.toUpperCase()}
                                    </span>
                                  </button>
                                ))}
                                {prospectiveModerators.length === 0 && (
                                  <div className="px-4 py-3 text-xs text-gray-400 italic">
                                    No se encontraron asistentes disponibles
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metrics retention panel */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Métricas de Permanencia en Mesa
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        
                        <div className="bg-[#1a2640]/40 border border-[#1e2d4a] p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Ingresaron al Evento</span>
                          <span className="text-2xl font-extrabold text-white mt-1">{totalArrived}</span>
                        </div>

                        <div className="bg-[#1a2640]/40 border border-[#1e2d4a] p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-[#60c0ea] uppercase">Se Quedaron (En Mesa)</span>
                          <span className="text-2xl font-extrabold text-[#60c0ea] mt-1">{totalStayed}</span>
                        </div>

                        <div className="bg-[#1a2640]/40 border border-[#1e2d4a] p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-red-400 uppercase">Se Fueron / No Llegaron</span>
                          <span className="text-2xl font-extrabold text-red-400 mt-1">{totalLeft}</span>
                        </div>

                        <div className="bg-[#1a2640]/40 border border-[#1e2d4a] p-4 rounded-xl flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">Tasa de Retención</span>
                          <span className="text-2xl font-extrabold text-emerald-400 mt-1">{retentionRate}%</span>
                        </div>

                      </div>
                    </div>

                    {/* Assistants List */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Participantes Asignados
                      </h3>
                      
                      {assistantsInSelectedMesa.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 border border-dashed border-[#1e2d4a] rounded-xl text-sm italic">
                          No hay participantes asignados a esta mesa de trabajo.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#1e2d4a] text-gray-400 text-xs font-semibold uppercase tracking-wider">
                                <th className="py-3 px-3">Nombre / C.I.</th>
                                <th className="py-3 px-3">Condominio / Teléfono</th>
                                <th className="py-3 px-3">Rol / Cargo</th>
                                <th className="py-3 px-3 text-center">Ingreso Evento</th>
                                <th className="py-3 px-3 text-center">Asistencia Verificada</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assistantsInSelectedMesa.map((ast) => {
                                const statusPart = (ast.estado || '').split('|')[0];
                                const isModerator = statusPart === `MODERADOR_MESA_${selectedMesaId}`;
                                const isVerified = isModerator || statusPart === 'VERIFICADO';

                                return (
                                  <tr 
                                    key={ast.id}
                                    className="border-b border-[#1e2d4a]/50 hover:bg-[#1a2640]/20 transition-colors text-sm last:border-0"
                                  >
                                    <td className="py-3.5 px-3">
                                      <div className="font-bold text-white uppercase flex items-center gap-1.5">
                                        {ast.nombre}
                                        {isModerator && (
                                          <span className="flex items-center gap-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
                                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> MOD
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-400 font-mono mt-0.5">C.I. {ast.cedula}</div>
                                    </td>
                                    
                                    <td className="py-3.5 px-3">
                                      <div className="text-gray-300 uppercase">{ast.condominio}</div>
                                      <div className="text-xs text-gray-400 font-mono mt-0.5">{ast.telefono}</div>
                                    </td>

                                    <td className="py-3.5 px-3">
                                      {ast.es_acompanante ? (
                                        ast.es_directivo ? (
                                          <span className="text-xs px-2 py-0.5 bg-cyan-950 text-cyan-400 rounded-md border border-cyan-900/50 uppercase font-medium">
                                            Directivo ({ast.cargo_directivo || 'N/D'})
                                          </span>
                                        ) : (
                                          <span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-400 rounded-md border border-blue-900/50 uppercase font-medium">
                                            Acompañante
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-xs px-2 py-0.5 bg-purple-950 text-purple-400 rounded-md border border-purple-900/50 uppercase font-medium">
                                          Presidente
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-3 text-center">
                                      {ast.asistio ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase font-semibold">
                                          <Check className="h-3 w-3" /> Registrado
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md uppercase font-semibold">
                                          <X className="h-3 w-3" /> Ausente
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-3 text-center">
                                      <button
                                        disabled={actionLoading || !ast.asistio || isModerator}
                                        onClick={() => handleToggleVerification(ast)}
                                        className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                          isVerified 
                                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25' 
                                            : 'bg-[#18233c] text-gray-400 border-transparent hover:border-gray-500'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                      >
                                        {isVerified ? (
                                          <>
                                            <CheckCircle2 className="h-3.5 w-3.5" /> SÍ (Verificado)
                                          </>
                                        ) : (
                                          <>
                                            <XCircle className="h-3.5 w-3.5" /> NO
                                          </>
                                        )}
                                      </button>
                                    </td>

                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              ) : (
                <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-12 text-center shadow-xl flex flex-col items-center justify-center gap-4 min-h-[400px]">
                  <div className="h-16 w-16 rounded-full bg-[#1a2640] flex items-center justify-center text-gray-500">
                    <ArrowRight className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white uppercase">Selecciona una Mesa</h3>
                  <p className="text-gray-400 text-sm max-w-sm">
                    Haz clic en una de las mesas de trabajo en el panel izquierdo para designar el moderador y verificar asistencia.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
