'use client';
 
 import { useState, useEffect } from 'react';
 import { supabase } from '@/lib/supabase';
 import { 
   Plus, Trash2, CheckCircle2, AlertTriangle, 
   RefreshCw, ClipboardList, Pencil, X,
   ChevronLeft, ChevronRight 
 } from 'lucide-react';
 
 const PARROQUIAS_POR_MUNICIPIO: { [key: string]: string[] } = {
   Girardot: [
     'José Casanova Godoy',
     'Las Delicias',
     'Madre María de San José',
     'Joaquín Crespo',
     'Pedro José Ovalle',
     'Andrés Eloy Blanco',
     'Choroní',
     'Florencio Jiménez'
   ],
   'Santiago Mariño': [
     'Turmero',
     'Samán de Güere',
     'Alfredo Pacheco Miranda',
     'Pedro Arévalo Aponte',
     'Chuao'
   ],
   'Mario Briceño Iragorry': [
     'El Limón',
     'Caña de Azúcar'
   ],
   'José Félix Ribas': [
     'Juan Vicente Bolívar y Ponte',
     'Castor Nieves Ríos',
     'Zuata',
     'Pao de Zárate',
     'Guacamaya'
   ],
   'Francisco Linares Alcántara': [
     'Santa Rita',
     'Francisco de Miranda',
     'Monseñor Feliciano González'
   ],
   Sucre: [
     'Cagua',
     'Bella Vista'
   ],
   Libertador: [
     'Palo Negro',
     'San Martín de Porres'
   ],
   Lamas: [
     'Santa Cruz'
   ],
   Zamora: [
     'Villa de Cura',
     'San Francisco de Asís',
     'Magdalena',
     'Tocorón',
     'Augusto Mijares'
   ],
   Tovar: [
     'Colonia Tovar'
   ]
 };
 
 interface Mesa {
   id: string;
   numero: number;
   nombre: string;
 }
 
 interface Asistente {
   id: string;
   nombre: string;
   cedula: string;
   telefono: string;
   condominio: string;
   municipio: string;
   parroquia?: string | null;
   asistio: boolean;
   es_acompanante?: boolean;
   es_directivo?: boolean;
   cargo_directivo?: string | null;
   whatsapp_status: string;
   whatsapp_error?: string;
   mesas_asignadas: {
     id: string;
     numero: number;
     nombre: string;
   }[];
 }
 
 interface DbAsistenteJoin {
   id: string;
   nombre: string;
   cedula: string;
   telefono: string;
   condominio: string;
   municipio: string;
   parroquia: string | null;
   asistio: boolean;
   es_acompanante: boolean | null;
   es_directivo: boolean | null;
   cargo_directivo: string | null;
   whatsapp_status: string;
   whatsapp_error: string | null;
   asistente_mesa: {
     mesas_trabajo: {
       id: string;
       numero: number;
       nombre: string;
     } | null;
   }[];
 }
 
 export default function AdminPage() {
   const [mesas, setMesas] = useState<Mesa[]>([]);
   const [asistentes, setAsistentes] = useState<Asistente[]>([]);
   const [currentPage, setCurrentPage] = useState(1);
   const itemsPerPage = 10;
   
   const [loading, setLoading] = useState(false);
   const [errorMsg, setErrorMsg] = useState('');
   const [successMsg, setSuccessMsg] = useState('');
   const [editingAsistenteId, setEditingAsistenteId] = useState<string | null>(null);
 
   // Form states for manual attendee
   const [nuevoAsistente, setNuevoAsistente] = useState<{
     nombre: string;
     cedula: string;
     telefono: string;
     condominio: string;
     municipio: string;
     parroquia: string;
     es_acompanante: boolean;
     es_directivo: boolean;
     cargo_directivo: string;
     mesa_preasignada_ids: string[];
   }>({
     nombre: '',
     cedula: '',
     telefono: '',
     condominio: '',
     municipio: 'Girardot',
     parroquia: 'José Casanova Godoy',
     es_acompanante: false,
     es_directivo: false,
     cargo_directivo: '',
     mesa_preasignada_ids: [],
   });
 
   const fetchData = async () => {
     try {
       setErrorMsg('');
       // Fetch Mesas
       const { data: dataMesas, error: errorMesas } = await supabase
         .from('mesas_trabajo')
         .select('*')
         .order('numero', { ascending: true });
       if (errorMesas) throw errorMesas;
       setMesas(dataMesas as Mesa[] || []);
 
       // Fetch Asistentes (joined with their assigned mesas through asistente_mesa)
       const { data: dataAsistentes, error: errorAsistentes } = await supabase
         .from('asistentes')
         .select(`
           id, nombre, cedula, telefono, condominio, municipio, parroquia, asistio, 
           es_acompanante, es_directivo, cargo_directivo,
           whatsapp_status, whatsapp_error,
           asistente_mesa (
             mesas_trabajo (id, numero, nombre)
           )
         `)
         .order('created_at', { ascending: false });
       
       if (errorAsistentes) throw errorAsistentes;
       
       // Transform data with proper typing
       const rawList = (dataAsistentes || []) as unknown as DbAsistenteJoin[];
       const formatted: Asistente[] = rawList.map((item) => ({
         id: item.id,
         nombre: item.nombre,
         cedula: item.cedula,
         telefono: item.telefono,
         condominio: item.condominio,
         municipio: item.municipio,
         parroquia: item.parroquia,
         asistio: item.asistio,
         es_acompanante: item.es_acompanante || false,
         es_directivo: item.es_directivo || false,
         cargo_directivo: item.cargo_directivo,
         whatsapp_status: item.whatsapp_status,
         whatsapp_error: item.whatsapp_error || undefined,
         mesas_asignadas: (item.asistente_mesa || [])
           .map(am => am.mesas_trabajo)
           .filter((m): m is { id: string; numero: number; nombre: string } => m !== null)
       }));
 
       setAsistentes(formatted);
     } catch (error) {
       console.error('Error fetching data:', error);
       setErrorMsg('Error al conectar con Supabase. Verifica la consola y el esquema SQL.');
     }
   };
 
   useEffect(() => {
     fetchData();
   }, []);

  const handleEditarClick = (a: Asistente) => {
    setErrorMsg('');
    setSuccessMsg('');
    setEditingAsistenteId(a.id);
    setNuevoAsistente({
      nombre: a.nombre,
      cedula: a.cedula,
      telefono: a.telefono,
      condominio: a.condominio,
      municipio: a.municipio,
      parroquia: a.parroquia || 'José Casanova Godoy',
      es_acompanante: a.es_acompanante || false,
      es_directivo: a.es_directivo || false,
      cargo_directivo: a.cargo_directivo || '',
      mesa_preasignada_ids: a.mesas_asignadas.map(m => m.id),
    });
  };

  const handleCancelarEdicion = () => {
    setEditingAsistenteId(null);
    setNuevoAsistente({
      nombre: '',
      cedula: '',
      telefono: '',
      condominio: '',
      municipio: 'Girardot',
      parroquia: 'José Casanova Godoy',
      es_acompanante: false,
      es_directivo: false,
      cargo_directivo: '',
      mesa_preasignada_ids: [],
    });
  };

  const handleCrearAsistente = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!nuevoAsistente.nombre || !nuevoAsistente.cedula || !nuevoAsistente.telefono || !nuevoAsistente.condominio) {
        throw new Error('Todos los campos obligatorios deben completarse.');
      }

      if (editingAsistenteId) {
        // Mode: Edit
        const payload = {
          nombre: nuevoAsistente.nombre,
          cedula: nuevoAsistente.cedula,
          telefono: nuevoAsistente.telefono,
          condominio: nuevoAsistente.condominio,
          municipio: nuevoAsistente.municipio,
          parroquia: nuevoAsistente.parroquia,
          es_acompanante: nuevoAsistente.es_acompanante,
          es_directivo: nuevoAsistente.es_acompanante ? nuevoAsistente.es_directivo : false,
          cargo_directivo: (nuevoAsistente.es_acompanante && nuevoAsistente.es_directivo) ? nuevoAsistente.cargo_directivo : null,
        };

        const { error } = await supabase
          .from('asistentes')
          .update(payload)
          .eq('id', editingAsistenteId);

        if (error) throw error;

        // Delete existing relations
        const { error: deleteRelError } = await supabase
          .from('asistente_mesa')
          .delete()
          .eq('asistente_id', editingAsistenteId);

        if (deleteRelError) throw deleteRelError;

        // Insert new relations
        if (nuevoAsistente.mesa_preasignada_ids.length > 0) {
          const relations = nuevoAsistente.mesa_preasignada_ids.map(mesaId => ({
            asistente_id: editingAsistenteId,
            mesa_id: mesaId
          }));
          const { error: relError } = await supabase
            .from('asistente_mesa')
            .insert(relations);
          if (relError) throw relError;
        }

        setSuccessMsg(`Asistente "${nuevoAsistente.nombre}" actualizado con éxito.`);
        setEditingAsistenteId(null);
      } else {
        // Mode: Create
        const payload = {
          nombre: nuevoAsistente.nombre,
          cedula: nuevoAsistente.cedula,
          telefono: nuevoAsistente.telefono,
          condominio: nuevoAsistente.condominio,
          municipio: nuevoAsistente.municipio,
          parroquia: nuevoAsistente.parroquia,
          es_acompanante: nuevoAsistente.es_acompanante,
          es_directivo: nuevoAsistente.es_acompanante ? nuevoAsistente.es_directivo : false,
          cargo_directivo: (nuevoAsistente.es_acompanante && nuevoAsistente.es_directivo) ? nuevoAsistente.cargo_directivo : null,
          asistio: false,
        };

        const { data, error } = await supabase
          .from('asistentes')
          .insert([payload])
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se pudo recuperar el ID del asistente insertado.');

        const asistenteId = data[0].id;

        if (nuevoAsistente.mesa_preasignada_ids.length > 0) {
          const relations = nuevoAsistente.mesa_preasignada_ids.map(mesaId => ({
            asistente_id: asistenteId,
            mesa_id: mesaId
          }));
          const { error: relError } = await supabase
            .from('asistente_mesa')
            .insert(relations);
          if (relError) throw relError;
        }

        setSuccessMsg(`Asistente "${nuevoAsistente.nombre}" registrado con éxito.`);
      }

      setNuevoAsistente({
        nombre: '',
        cedula: '',
        telefono: '',
        condominio: '',
        municipio: 'Girardot',
        parroquia: 'José Casanova Godoy',
        es_acompanante: false,
        es_directivo: false,
        cargo_directivo: '',
        mesa_preasignada_ids: [],
      });
      fetchData();
    } catch (err) {
      console.error(err);
      const errorObj = err as Error;
      setErrorMsg(errorObj.message || 'Error al procesar el asistente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiarAsistencias = async () => {
    if (!confirm('¿Estás seguro de que quieres restablecer el estado de asistencia de todos los invitados?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('asistentes')
        .update({ 
          asistio: false, 
          fecha_registro: null, 
          whatsapp_status: 'no_enviado', 
          whatsapp_error: null 
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // hack para actualizar todos en supabase
      if (error) throw error;
      setSuccessMsg('Estado de asistencia restablecido para todos los participantes.');
      fetchData();
    } catch (err) {
      console.error(err);
      const errorObj = err as Error;
      setErrorMsg(errorObj.message || 'Error al restablecer asistencias.');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(Math.ceil(asistentes.length / itemsPerPage), 1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = asistentes.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [asistentes, currentPage, totalPages]);

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Panel de Administración</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gestión de base de datos, inicialización de datos de prueba y registro de invitados.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Recargar
          </button>
          <button
            onClick={handleLimpiarAsistencias}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-950/20 border border-red-900/50 text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Restablecer Asistencia
          </button>
        </div>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="p-4 bg-red-950/25 border border-red-900/50 text-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Error</span>
            <span className="text-sm">{errorMsg}</span>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-950/25 border border-emerald-900/50 text-emerald-200 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Acción completada</span>
            <span className="text-sm">{successMsg}</span>
          </div>
        </div>
      )}



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Formulario para agregar/editar asistente */}
         <div className="lg:col-span-1 bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
           <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
             {editingAsistenteId ? (
               <>
                 <Pencil className="h-5 w-5 text-[#f3af30]" /> Editar Asistente
               </>
             ) : (
               <>
                 <Plus className="h-5 w-5 text-[#60c0ea]" /> Registrar Nuevo Invitado
               </>
             )}
           </h2>
 
           <form onSubmit={handleCrearAsistente} className="space-y-4">
             <div>
               <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nombre Completo *</label>
               <input
                 type="text"
                 required
                 value={nuevoAsistente.nombre}
                 onChange={e => setNuevoAsistente({ ...nuevoAsistente, nombre: e.target.value })}
                 className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                 placeholder="Nombre del presidente"
               />
             </div>
 
             <div>
               <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cédula de Identidad *</label>
               <input
                 type="text"
                 required
                 value={nuevoAsistente.cedula}
                 onChange={e => setNuevoAsistente({ ...nuevoAsistente, cedula: e.target.value })}
                 className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                 placeholder="Ej. 12345678"
               />
             </div>
 
             <div>
               <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Teléfono (WhatsApp) *</label>
               <input
                 type="text"
                 required
                 value={nuevoAsistente.telefono}
                 onChange={e => setNuevoAsistente({ ...nuevoAsistente, telefono: e.target.value })}
                 className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                 placeholder="Ej. 04141234567"
               />
             </div>
 
             <div>
               <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nombre del Condominio *</label>
               <input
                 type="text"
                 required
                 value={nuevoAsistente.condominio}
                 onChange={e => setNuevoAsistente({ ...nuevoAsistente, condominio: e.target.value })}
                 className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                 placeholder="Ej. Condominio El Paraíso"
               />
             </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Municipio *</label>
                <select
                  value={nuevoAsistente.municipio}
                  onChange={e => {
                    const newMuni = e.target.value;
                    const defaultParroquia = PARROQUIAS_POR_MUNICIPIO[newMuni]?.[0] || '';
                    setNuevoAsistente({ 
                      ...nuevoAsistente, 
                      municipio: newMuni,
                      parroquia: defaultParroquia
                    });
                  }}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                >
                   <option value="Girardot">Girardot</option>
                   <option value="Santiago Mariño">Santiago Mariño</option>
                   <option value="Mario Briceño Iragorry">Mario Briceño Iragorry</option>
                   <option value="José Félix Ribas">José Félix Ribas</option>
                   <option value="Francisco Linares Alcántara">Francisco Linares Alcántara</option>
                   <option value="Sucre">Sucre</option>
                   <option value="Libertador">Libertador</option>
                   <option value="Lamas">Lamas</option>
                   <option value="Zamora">Zamora</option>
                   <option value="Tovar">Tovar</option>
                </select>
              </div>
 
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Parroquia *</label>
                <select
                  value={nuevoAsistente.parroquia}
                  onChange={e => setNuevoAsistente({ ...nuevoAsistente, parroquia: e.target.value })}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                >
                  {(PARROQUIAS_POR_MUNICIPIO[nuevoAsistente.municipio] || []).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
 
             {/* Opción de Acompañante / Directivo */}
             <div className="space-y-3 pt-2 border-t border-[#1e2d4a]">
               <label className="flex items-center gap-2 text-sm text-gray-300 hover:text-white cursor-pointer">
                 <input
                   type="checkbox"
                   checked={nuevoAsistente.es_acompanante}
                   onChange={e => setNuevoAsistente({ 
                     ...nuevoAsistente, 
                     es_acompanante: e.target.checked,
                     es_directivo: e.target.checked ? nuevoAsistente.es_directivo : false,
                     cargo_directivo: e.target.checked ? nuevoAsistente.cargo_directivo : ''
                   })}
                   className="rounded border-[#1e2d4a] bg-[#111a2e] text-[#60c0ea] focus:ring-0 focus:ring-offset-0"
                 />
                 <span>¿Es Acompañante? (Invitado)</span>
               </label>
 
               {nuevoAsistente.es_acompanante && (
                 <div className="pl-6 space-y-3 border-l-2 border-[#1e2d4a] animate-slide-down">
                   <label className="flex items-center gap-2 text-sm text-gray-300 hover:text-white cursor-pointer">
                     <input
                       type="checkbox"
                       checked={nuevoAsistente.es_directivo}
                       onChange={e => setNuevoAsistente({ 
                         ...nuevoAsistente, 
                         es_directivo: e.target.checked,
                         cargo_directivo: e.target.checked ? nuevoAsistente.cargo_directivo : ''
                       })}
                       className="rounded border-[#1e2d4a] bg-[#111a2e] text-[#60c0ea] focus:ring-0 focus:ring-offset-0"
                     />
                     <span>¿Es Directivo del Condominio?</span>
                   </label>
 
                   {nuevoAsistente.es_directivo && (
                     <div>
                       <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cargo Directivo *</label>
                       <input
                         type="text"
                         required
                         value={nuevoAsistente.cargo_directivo}
                         onChange={e => setNuevoAsistente({ ...nuevoAsistente, cargo_directivo: e.target.value })}
                         className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                         placeholder="Ej. Vocal, Tesorero, etc."
                       />
                     </div>
                   )}
                 </div>
               )}
             </div>
 
             <div>
               <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mesas Preasignadas</label>
               <div className="space-y-2 bg-[#1a2640] border border-[#1e2d4a] rounded-lg p-3 max-h-48 overflow-y-auto">
                 {mesas.map(m => {
                   const isChecked = nuevoAsistente.mesa_preasignada_ids.includes(m.id);
                   return (
                     <label key={m.id} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white cursor-pointer py-1">
                       <input
                         type="checkbox"
                         checked={isChecked}
                         onChange={() => {
                           if (isChecked) {
                             setNuevoAsistente({
                               ...nuevoAsistente,
                               mesa_preasignada_ids: nuevoAsistente.mesa_preasignada_ids.filter(id => id !== m.id)
                             });
                           } else {
                             setNuevoAsistente({
                               ...nuevoAsistente,
                               mesa_preasignada_ids: [...nuevoAsistente.mesa_preasignada_ids, m.id]
                             });
                           }
                         }}
                         className="rounded border-[#1e2d4a] bg-[#111a2e] text-[#60c0ea] focus:ring-0 focus:ring-offset-0"
                       />
                       <span>Mesa {m.numero} ({m.nombre})</span>
                     </label>
                   );
                 })}
               </div>
             </div>
 
             <div className="space-y-2 pt-2">
               <button
                 type="submit"
                 disabled={loading}
                 className="w-full py-2 bg-[#004e74] hover:bg-[#004e74]/80 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
               >
                 {editingAsistenteId ? 'Guardar Cambios' : 'Registrar Presidente'}
               </button>
 
               {editingAsistenteId && (
                 <button
                   type="button"
                   onClick={handleCancelarEdicion}
                   className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5"
                 >
                   <X className="h-4 w-4" /> Cancelar Edición
                 </button>
               )}
             </div>
           </form>
         </div>

        {/* Listado de Asistentes cargados */}
        <div className="lg:col-span-2 bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
            <ClipboardList className="h-5 w-5 text-[#f3af30]" /> Listado de Asistentes e Invitados ({asistentes.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#1e2d4a] text-gray-400">
                  <th className="py-3 px-2">Cédula</th>
                  <th className="py-3 px-2">Nombre</th>
                  <th className="py-3 px-2">Condominio</th>
                  <th className="py-3 px-2">Mesas Preasignadas</th>
                  <th className="py-3 px-2">Asistió</th>
                  <th className="py-3 px-2">Notificación WA</th>
                  <th className="py-3 px-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {asistentes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No hay ningún asistente en la base de datos.
                    </td>
                  </tr>
                ) : (
                  currentItems.map(a => (
                    <tr key={a.id} className="hover:bg-[#15223e] transition-colors">
                      <td className="py-3 px-2 font-mono font-medium">{a.cedula || 'N/A'}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{a.nombre}</span>
                          {a.es_acompanante ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-950/40 text-amber-400 border border-amber-900/60" title={a.es_directivo ? `Directivo: ${a.cargo_directivo}` : 'Acompañante'}>
                              Acompañante {a.es_directivo && `(${a.cargo_directivo})`}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#004e74]/20 text-[#60c0ea] border border-[#004e74]/40">
                              Presidente
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">{a.municipio} {a.parroquia && `(${a.parroquia})`} | {a.telefono}</div>
                      </td>
                      <td className="py-3 px-2 max-w-[150px] truncate">{a.condominio}</td>
                      <td className="py-3 px-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {a.mesas_asignadas && a.mesas_asignadas.length > 0 ? (
                            a.mesas_asignadas.map((m, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-[#004e74]/20 border border-[#004e74]/40 text-[#60c0ea]" title={m.nombre}>
                                Mesa {m.numero}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500">No asignada</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {a.asistio ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-900/60">
                            Sí
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                            No
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {a.whatsapp_status === 'enviado' ? (
                          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Enviado
                          </span>
                        ) : a.whatsapp_status === 'error' ? (
                          <span className="text-rose-400 text-xs font-medium flex flex-col" title={a.whatsapp_error}>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span> Falló
                            </span>
                            <span className="text-[10px] text-gray-500 truncate max-w-[100px]">{a.whatsapp_error}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Pendiente</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => handleEditarClick(a)}
                          title="Editar asistente"
                          className="p-1.5 text-xs rounded bg-[#1a2640] border border-[#1e2d4a] text-gray-300 hover:text-white hover:bg-[#1e2d4a] transition-colors"
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

          {/* Controles de Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#1e2d4a] pt-4 mt-4 text-xs">
              <span className="text-gray-400">
                Mostrando <span className="font-semibold text-white">{indexOfFirstItem + 1}</span> a{' '}
                <span className="font-semibold text-white">
                  {Math.min(indexOfLastItem, asistentes.length)}
                </span>{' '}
                de <span className="font-semibold text-white">{asistentes.length}</span> invitados
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
      </div>
    </div>
  );
}
