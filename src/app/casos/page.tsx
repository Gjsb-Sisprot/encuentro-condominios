'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Search, ShieldAlert, CheckCircle2, HelpCircle, 
  User, Phone, Clipboard, Save, X, RefreshCw,
  ChevronLeft, ChevronRight 
} from 'lucide-react';

interface CasoInfraestructura {
  id: string;
  condominio: string;
  municipio: string;
  parroquia: string | null;
  problematica: string;
  prioridad: string;
  estado: string; // 'Pendiente', 'En progreso', 'Resuelto'
  fecha_reporte: string;
  notas_resolucion: string | null;
}

interface PresidenteVinculado {
  nombre: string;
  cedula: string;
  telefono: string;
  condominio: string;
  asistio: boolean;
}

export default function CasosPage() {
  const [casos, setCasos] = useState<CasoInfraestructura[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('Todos');
  const [selectedEstado, setSelectedEstado] = useState('Todos');
  const [selectedPrioridad, setSelectedPrioridad] = useState('Todos');

  // Reset current page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMunicipio, selectedEstado, selectedPrioridad]);

  // Modal / Selected Case states
  const [selectedCaso, setSelectedCaso] = useState<CasoInfraestructura | null>(null);
  const [presidenteVinculado, setPresidenteVinculado] = useState<PresidenteVinculado | null>(null);
  const [loadingPresidente, setLoadingPresidente] = useState(false);
  const [notasResolucion, setNotasResolucion] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('Pendiente');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchCasos = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('casos_infraestructura')
        .select('*')
        .order('fecha_reporte', { ascending: false });

      if (error) throw error;
      setCasos((data || []) as CasoInfraestructura[]);
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCasos();
  }, []);

  // Fetch linked president when selected caso changes
  useEffect(() => {
    if (!selectedCaso) {
      setPresidenteVinculado(null);
      return;
    }

    const fetchPresidente = async () => {
      try {
        setLoadingPresidente(true);
        // Buscar asistente cuyo condominio coincida exactamente o parcialmente (insensible a mayúsculas/minúsculas)
        const { data, error } = await supabase
          .from('asistentes')
          .select('nombre, cedula, telefono, condominio, asistio')
          .ilike('condominio', `%${selectedCaso.condominio}%`);

        if (error) throw error;

        if (data && data.length > 0) {
          setPresidenteVinculado(data[0] as PresidenteVinculado);
        } else {
          setPresidenteVinculado(null);
        }
      } catch (err) {
        console.error('Error fetching linked president:', err);
      } finally {
        setLoadingPresidente(false);
      }
    };

    fetchPresidente();
    setNotasResolucion(selectedCaso.notas_resolucion || '');
    setNuevoEstado(selectedCaso.estado);
    setSaveSuccess(false);
  }, [selectedCaso]);

  const handleSaveChanges = async () => {
    if (!selectedCaso) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('casos_infraestructura')
        .update({
          estado: nuevoEstado,
          notas_resolucion: notasResolucion
        })
        .eq('id', selectedCaso.id);

      if (error) throw error;

      setSaveSuccess(true);
      
      // Update local state
      setCasos(prev => prev.map(c => c.id === selectedCaso.id ? { ...c, estado: nuevoEstado, notas_resolucion: notasResolucion } : c));
      
      // Update selected case state partially
      setSelectedCaso(prev => prev ? { ...prev, estado: nuevoEstado, notas_resolucion: notasResolucion } : null);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating case:', err);
    } finally {
      setSaving(false);
    }
  };

  // Local Reactive Filtering (Ultra fast local search & filter)
  const filteredCasos = casos.filter(caso => {
    const matchesSearch = caso.condominio.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          caso.problematica.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMunicipio = selectedMunicipio === 'Todos' || caso.municipio === selectedMunicipio;
    const matchesEstado = selectedEstado === 'Todos' || caso.estado === selectedEstado;
    const matchesPrioridad = selectedPrioridad === 'Todos' || caso.prioridad === selectedPrioridad;

    return matchesSearch && matchesMunicipio && matchesEstado && matchesPrioridad;
  });

  const totalPages = Math.max(Math.ceil(filteredCasos.length / itemsPerPage), 1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCasos.slice(indexOfFirstItem, indexOfLastItem);

  const uniqueMunicipios = Array.from(new Set(casos.map(c => c.municipio)));

  return (
    <div className="space-y-8 animate-slide-up relative">
      
      {/* Encabezado */}
      <div className="flex justify-between items-center border-b border-[#1e2d4a] pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-[#60c0ea]" /> Casos de Infraestructura
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Gestión de problemáticas de infraestructura reportadas por los condominios en el censo.
          </p>
        </div>
        <button
          onClick={fetchCasos}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Recargar
        </button>
      </div>

      {/* Filtros de Velocidad de Filtrado */}
      <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Filtros de Búsqueda Rápida
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Buscar por Condominio */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por condominio..."
              className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white text-xs rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#60c0ea]"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          </div>

          {/* Filtrar por Municipio */}
          <select
            value={selectedMunicipio}
            onChange={e => setSelectedMunicipio(e.target.value)}
            className="bg-[#1a2640] border border-[#1e2d4a] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#60c0ea]"
          >
            <option value="Todos">Todos los Municipios</option>
            {uniqueMunicipios.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Filtrar por Estado */}
          <select
            value={selectedEstado}
            onChange={e => setSelectedEstado(e.target.value)}
            className="bg-[#1a2640] border border-[#1e2d4a] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#60c0ea]"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En progreso">En progreso</option>
            <option value="Resuelto">Resuelto</option>
          </select>

          {/* Filtrar por Prioridad */}
          <select
            value={selectedPrioridad}
            onChange={e => setSelectedPrioridad(e.target.value)}
            className="bg-[#1a2640] border border-[#1e2d4a] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#60c0ea]"
          >
            <option value="Todos">Todas las Prioridades</option>
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>
        </div>
      </div>

      {/* Tabla de Casos */}
      <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-[#60c0ea]" />
            <span>Cargando casos de infraestructura...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1e2d4a] text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-4 font-bold">Condominio</th>
                  <th className="py-4 px-4 font-bold">Municipio / Parroquia</th>
                  <th className="py-4 px-4 font-bold">Problemática Reportada</th>
                  <th className="py-4 px-4 font-bold">Prioridad</th>
                  <th className="py-4 px-4 font-bold">Estado</th>
                  <th className="py-4 px-4 font-bold text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {filteredCasos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500 font-medium">
                      No se encontraron casos de infraestructura con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  currentItems.map(caso => (
                    <tr 
                      key={caso.id} 
                      onClick={() => setSelectedCaso(caso)}
                      className="hover:bg-[#15223e]/50 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-4 font-bold text-white max-w-[200px] truncate">
                        {caso.condominio}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-200">{caso.municipio}</div>
                        <div className="text-[10px] text-gray-400">{caso.parroquia || 'N/D'}</div>
                      </td>
                      <td className="py-4 px-4 max-w-sm">
                        <p className="text-gray-300 truncate">{caso.problematica}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          caso.prioridad === 'Alta' 
                            ? 'bg-red-950/40 text-red-400 border border-red-900/50' 
                            : caso.prioridad === 'Media'
                            ? 'bg-[#f3af30]/10 text-[#f3af30] border border-[#f3af30]/20'
                            : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50'
                        }`}>
                          {caso.prioridad}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1.5 ${
                          caso.estado === 'Resuelto'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : caso.estado === 'En progreso'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'bg-[#ffd880]/10 text-[#ffd880] border border-[#ffd880]/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            caso.estado === 'Resuelto' ? 'bg-emerald-400' : caso.estado === 'En progreso' ? 'bg-cyan-400' : 'bg-[#ffd880]'
                          }`}></span>
                          {caso.estado}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-400">
                        {caso.fecha_reporte}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Controles de Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#1e2d4a] p-4 text-xs bg-[#111a2e]">
            <span className="text-gray-400">
              Mostrando <span className="font-semibold text-white">{indexOfFirstItem + 1}</span> a{' '}
              <span className="font-semibold text-white">
                {Math.min(indexOfLastItem, filteredCasos.length)}
              </span>{' '}
              de <span className="font-semibold text-white">{filteredCasos.length}</span> casos
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-gray-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <div className="flex items-center gap-1.5 text-gray-400 px-2 font-medium">
                Página {currentPage} de {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-gray-300"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLES DEL CASO Y PRESIDENTE VINCULADO */}
      {selectedCaso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-[#1e2d4a] bg-[#0b111e]/50">
              <div>
                <span className="text-[10px] font-bold text-[#60c0ea] uppercase tracking-widest block mb-1">Detalle del Caso</span>
                <h2 className="text-xl font-bold text-white">{selectedCaso.condominio}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedCaso.municipio} • {selectedCaso.parroquia}</p>
              </div>
              <button 
                onClick={() => setSelectedCaso(null)} 
                className="p-1 rounded-lg text-gray-400 hover:bg-[#1a2640] hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              
              {/* Problemática Reportada */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clipboard className="h-4 w-4 text-[#f3af30]" /> Problemática Reportada
                </h3>
                <div className="p-4 bg-[#0b111e] border border-[#1e2d4a] rounded-xl text-gray-200 text-xs whitespace-pre-line leading-relaxed font-mono">
                  {selectedCaso.problematica}
                </div>
              </div>

              {/* DATOS DEL PRESIDENTE VINCULADO */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="h-4 w-4 text-[#60c0ea]" /> Presidente de Condominio Vinculado
                </h3>
                {loadingPresidente ? (
                  <div className="p-4 bg-[#0b111e] border border-[#1e2d4a] rounded-xl flex items-center justify-center py-6 text-gray-400 gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-[#60c0ea]" />
                    <span className="text-xs">Buscando datos vinculados...</span>
                  </div>
                ) : presidenteVinculado ? (
                  <div className="p-4 bg-[#004e74]/10 border border-[#004e74]/40 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Nombre del Presidente</span>
                      <span className="text-sm font-semibold text-white">{presidenteVinculado.nombre}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Cédula de Identidad</span>
                      <span className="text-sm font-mono text-white">{presidenteVinculado.cedula}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Teléfono (WhatsApp)</span>
                      <span className="text-sm font-semibold text-[#60c0ea] flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-[#60c0ea]" /> {presidenteVinculado.telefono}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Estatus de Asistencia</span>
                      <span className={`text-xs font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                        presidenteVinculado.asistio 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {presidenteVinculado.asistio ? 'Presente en el evento' : 'No ha registrado asistencia'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-950/20 border border-yellow-900/50 rounded-xl text-yellow-200 text-xs flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-yellow-400 shrink-0" />
                    <span>No se ha encontrado un presidente registrado para este condominio. Puedes agregarlo en la sección de administración.</span>
                  </div>
                )}
              </div>

              {/* Gestión del Caso */}
              <div className="space-y-4 border-t border-[#1e2d4a] pt-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Save className="h-4 w-4 text-[#db8a2a]" /> Gestión del Caso
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Estado del Caso</label>
                    <div className="flex gap-2 pt-1">
                      {['Pendiente', 'En progreso', 'Resuelto'].map(est => (
                        <button
                          key={est}
                          onClick={() => setNuevoEstado(est)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                            nuevoEstado === est
                              ? est === 'Resuelto'
                                ? 'bg-emerald-950/50 border-emerald-500 text-emerald-400'
                                : est === 'En progreso'
                                ? 'bg-cyan-950/50 border-cyan-500 text-cyan-400'
                                : 'bg-[#ffd880]/20 border-[#ffd880] text-[#ffd880]'
                              : 'bg-[#1a2640] border-[#1e2d4a] text-gray-400 hover:text-white'
                          }`}
                        >
                          {est}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Fecha de reporte</label>
                    <input 
                      type="text" 
                      disabled 
                      value={selectedCaso.fecha_reporte}
                      className="w-full bg-[#1a2640]/50 border border-[#1e2d4a] text-gray-400 text-xs font-mono rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Notas de resolución (Opcional)</label>
                  <textarea
                    rows={3}
                    value={notasResolucion}
                    onChange={e => setNotasResolucion(e.target.value)}
                    placeholder="Describe las acciones tomadas o el resultado..."
                    className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#60c0ea]"
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#1e2d4a] bg-[#0b111e]/50 flex justify-between items-center">
              {saveSuccess ? (
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> ¡Cambios guardados con éxito!
                </span>
              ) : (
                <span></span>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCaso(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-[#1a2640] text-gray-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[#004e74] hover:bg-[#004e74]/80 text-white transition-colors flex items-center gap-1.5"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
