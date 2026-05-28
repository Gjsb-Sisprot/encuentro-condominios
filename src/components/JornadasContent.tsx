'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, Play, Users, CheckCircle, 
  AlertCircle, Trash2, ArrowRight, FileSpreadsheet, Loader2 
} from 'lucide-react';
import { cleanCedula, cleanTelefono } from '@/lib/utils';

interface JornadaStat {
  nombre: string;
  totalInvitados: number;
  totalAsistieron: number;
  totalVerificados: number;
}

interface ExcelRow {
  'Presidente Condominio'?: string;
  'Nombre'?: string;
  'Cédula Presidente'?: string | number;
  'Cedula Presidente'?: string | number;
  'Cedula'?: string | number;
  'Teléfono Presidente'?: string | number;
  'Telefono Presidente'?: string | number;
  'Telefono'?: string | number;
  'Nombre del Urbanismo'?: string;
  'Condominio'?: string;
  'Municipio'?: string;
  'Parroquia'?: string;
  [key: string]: unknown;
}

export default function JornadasContent() {
  const [jornadas, setJornadas] = useState<JornadaStat[]>([]);
  const [activeJornada, setActiveJornada] = useState<string>('Jornada General');
  const [nuevaJornadaName, setNuevaJornadaName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  // Loading & Progress States
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch unique jornadas and calculate stats
  const fetchJornadasStats = async () => {
    try {
      const { data, error } = await supabase
        .from('asistentes')
        .select('estado, asistio');

      if (error) throw error;

      if (data) {
        // Group by jornada name
        const statsMap: { [key: string]: { total: number; asistio: number; verificado: number } } = {};
        
        data.forEach(item => {
          const estadoStr = item.estado || '';
          const parts = estadoStr.split('|');
          const status = parts[0] || '';
          const jornadaName = parts[1] || 'Jornada General';

          if (!statsMap[jornadaName]) {
            statsMap[jornadaName] = { total: 0, asistio: 0, verificado: 0 };
          }

          statsMap[jornadaName].total += 1;
          if (item.asistio) {
            statsMap[jornadaName].asistio += 1;
          }
          if (status === 'VERIFICADO' || status.startsWith('MODERADOR_MESA_')) {
            statsMap[jornadaName].verificado += 1;
          }
        });

        const formatted = Object.keys(statsMap).map(name => ({
          nombre: name,
          totalInvitados: statsMap[name].total,
          totalAsistieron: statsMap[name].asistio,
          totalVerificados: statsMap[name].verificado
        })).sort((a, b) => a.nombre.localeCompare(b.nombre));

        setJornadas(formatted);
      }
    } catch {
      console.error('Error fetching jornadas stats');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('active_jornada') || 'Jornada General';
      setActiveJornada(saved);
      
      // Auto-suggest name for new jornada
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      setNuevaJornadaName(`JORNADA ${dd}-${mm}`);
    }

    fetchJornadasStats();

    const onJornadaChanged = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setActiveJornada(customEvent.detail);
    };

    window.addEventListener('jornadaChanged', onJornadaChanged);
    return () => {
      window.removeEventListener('jornadaChanged', onJornadaChanged);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const handleImportJornada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaJornadaName.trim()) {
      setErrorMsg('Por favor introduce un nombre para la jornada.');
      return;
    }
    if (!file) {
      setErrorMsg('Por favor selecciona un archivo Excel (.xlsx).');
      return;
    }

    setLoading(true);
    setProgressMsg('Leyendo archivo Excel...');
    setProgressPercent(5);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Read file
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      const fileData = await new Promise<ExcelRow[]>((resolve, reject) => {
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
            resolve(json);
          } catch {
            reject(new Error('Error al decodificar el archivo Excel.'));
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsArrayBuffer(file);
      });

      if (fileData.length === 0) {
        throw new Error('El archivo Excel está vacío.');
      }

      // 2. Fetch Mesas Map to support pre-assignment
      setProgressMsg('Obteniendo configuración de mesas...');
      setProgressPercent(15);
      const { data: dbMesas, error: dbMesasErr } = await supabase
        .from('mesas_trabajo')
        .select('*');
      if (dbMesasErr) throw dbMesasErr;
      
      const mesasArray = dbMesas || [];

      // Helper to map text to Mesa ID
      const findMesaId = (serviceName: string): string | null => {
        if (!serviceName) return null;
        const normalized = serviceName.toUpperCase();
        if (normalized.includes('IMPERMEABILIZA')) return mesasArray.find(m => m.numero === 1)?.id || null;
        if (normalized.includes('ASCENSOR')) return mesasArray.find(m => m.numero === 2)?.id || null;
        if (normalized.includes('AGUA') || normalized.includes('PLOMERIA') || normalized.includes('HIDRICA')) {
          return mesasArray.find(m => m.numero === 3)?.id || null;
        }
        if (normalized.includes('ASFALTO')) return mesasArray.find(m => m.numero === 4)?.id || null;
        if (normalized.includes('PODA') || normalized.includes('TALA') || normalized.includes('VERDES')) {
          return mesasArray.find(m => m.numero === 5)?.id || null;
        }
        if (normalized.includes('ILUMINACION') || normalized.includes('LUMINARIA') || normalized.includes('POSTE')) {
          return mesasArray.find(m => m.numero === 6)?.id || null;
        }
        return null;
      };

      // 3. Archiving older clean cedulas to prevent duplicate constraints
      setProgressMsg('Respaldando e indexando cédulas de jornadas anteriores...');
      setProgressPercent(30);

      // Get all current assistants who have a clean cedula (doesn't contain dash-jornadaName)
      const { data: currentAsistentes, error: curErr } = await supabase
        .from('asistentes')
        .select('id, cedula, estado')
        .not('cedula', 'like', '%-%');

      if (curErr) throw curErr;

      if (currentAsistentes && currentAsistentes.length > 0) {
        const batchUpdates = currentAsistentes.map(async (ast) => {
          const parts = (ast.estado || '').split('|');
          const jName = parts[1] || 'Jornada General';
          const newCedula = `${ast.cedula}-${jName.replace(/\s+/g, '')}`;
          return supabase
            .from('asistentes')
            .update({ cedula: newCedula })
            .eq('id', ast.id);
        });
        await Promise.all(batchUpdates);
      }

      // 4. Batch inserting new assistants
      setProgressMsg(`Preparando importación de ${fileData.length} registros...`);
      setProgressPercent(50);

      const batchSize = 30;
      const totalBatches = Math.ceil(fileData.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, fileData.length);
        const batchRows = fileData.slice(start, end);

        setProgressMsg(`Importando lote ${i + 1} de ${totalBatches}...`);
        setProgressPercent(50 + Math.round((i / totalBatches) * 45));

        const insertPayload = batchRows.map((row: ExcelRow) => {
          const rawCedula = row['Cédula Presidente'] || row['Cedula Presidente'] || row['Cedula'] || '';
          const rawTelefono = row['Teléfono Presidente'] || row['Telefono Presidente'] || row['Telefono'] || '';
          
          return {
            nombre: String(row['Presidente Condominio'] || row['Nombre'] || 'Invitado').toUpperCase(),
            cedula: cleanCedula(String(rawCedula)),
            telefono: cleanTelefono(String(rawTelefono)),
            condominio: String(row['Nombre del Urbanismo'] || row['Condominio'] || 'N/D').toUpperCase(),
            municipio: String(row['Municipio'] || 'Girardot'),
            parroquia: String(row['Parroquia'] || ''),
            estado: `|${nuevaJornadaName}`,
            asistio: false,
            es_acompanante: false,
            es_directivo: false
          };
        }).filter(item => item.cedula && item.nombre);

        if (insertPayload.length > 0) {
          const { data: insertedList, error: insertErr } = await supabase
            .from('asistentes')
            .insert(insertPayload)
            .select('id, cedula');

          if (insertErr) throw insertErr;

          // Map and insert preassigned tables relation (asistente_mesa)
          if (insertedList && insertedList.length > 0) {
            const relationsPayload: { asistente_id: string; mesa_id: string }[] = [];
            
            batchRows.forEach((row: ExcelRow) => {
              const rawCedula = row['Cédula Presidente'] || row['Cedula Presidente'] || row['Cedula'] || '';
              const cleaned = cleanCedula(String(rawCedula));
              const insertedUser = insertedList.find(u => u.cedula === cleaned);
              
              if (insertedUser) {
                // Collect preassigned tables columns
                const serviceColumns = Object.keys(row).filter(k => k.startsWith('MESA DE LOS SERVICIOS'));
                serviceColumns.forEach(col => {
                  const mId = findMesaId(row[col] as string);
                  if (mId) {
                    relationsPayload.push({
                      asistente_id: insertedUser.id,
                      mesa_id: mId
                    });
                  }
                });
              }
            });

            if (relationsPayload.length > 0) {
              const { error: relErr } = await supabase
                .from('asistente_mesa')
                .insert(relationsPayload);
              if (relErr) {
                console.error('Error insertando relaciones de mesas:', relErr);
              }
            }
          }
        }
      }

      setProgressPercent(100);
      setSuccessMsg(`Jornada "${nuevaJornadaName}" creada e importada con éxito.`);
      setFile(null);
      
      // Select the newly imported jornada as active
      localStorage.setItem('active_jornada', nuevaJornadaName);
      setActiveJornada(nuevaJornadaName);
      window.dispatchEvent(new CustomEvent('jornadaChanged', { detail: nuevaJornadaName }));
      
      await fetchJornadasStats();
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error durante la importación. Revisa el formato.';
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleDeleteJornada = async (jName: string) => {
    if (jName === 'Jornada General') {
      alert('La Jornada General no puede ser eliminada.');
      return;
    }
    if (!confirm(`¿Estás completamente seguro de eliminar la jornada "${jName}"? Se borrarán todos los asistentes y registros asociados.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('asistentes')
        .delete()
        .ilike('estado', `%|${jName}`);

      if (error) throw error;
      
      setSuccessMsg(`Jornada "${jName}" eliminada correctamente.`);
      
      if (activeJornada === jName) {
        localStorage.setItem('active_jornada', 'Jornada General');
        setActiveJornada('Jornada General');
        window.dispatchEvent(new CustomEvent('jornadaChanged', { detail: 'Jornada General' }));
      }
      
      await fetchJornadasStats();
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Error al eliminar la jornada.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectJornada = (jName: string) => {
    localStorage.setItem('active_jornada', jName);
    setActiveJornada(jName);
    window.dispatchEvent(new CustomEvent('jornadaChanged', { detail: jName }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-[#1e2d4a] pb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#60c0ea] to-[#004e74] flex items-center justify-center text-[#111a2e] shadow-lg shadow-[#60c0ea]/10">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight uppercase">Jornadas del Evento</h1>
              <p className="text-gray-400 text-sm">
                Controla los eventos y cargas de datos por fecha. Sube listados de invitados y visualiza métricas de jornadas históricas.
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#111a2e] border border-[#1e2d4a] p-5 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-[#60c0ea]/10 text-[#60c0ea] rounded-xl">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-bold uppercase block">Jornada Activa</span>
              <span className="text-lg font-black uppercase text-white">{activeJornada}</span>
            </div>
          </div>

          <div className="bg-[#111a2e] border border-[#1e2d4a] p-5 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-bold uppercase block">Total Jornadas</span>
              <span className="text-xl font-black text-white">{jornadas.length}</span>
            </div>
          </div>

          <div className="bg-[#111a2e] border border-[#1e2d4a] p-5 rounded-2xl flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-bold uppercase block">Total Invitados Históricos</span>
              <span className="text-xl font-black text-white">
                {jornadas.reduce((acc, curr) => acc + curr.totalInvitados, 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create & Import Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#111a2e] border border-[#1e2d4a] p-6 rounded-2xl shadow-xl space-y-5">
              <h2 className="text-lg font-extrabold text-white uppercase tracking-wider border-b border-[#1e2d4a] pb-3 flex items-center gap-2">
                <Play className="h-5 w-5 text-[#60c0ea]" /> Iniciar Nueva Jornada
              </h2>

              {errorMsg && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleImportJornada} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">Nombre del Evento / Jornada</label>
                  <input
                    type="text"
                    disabled={loading}
                    value={nuevaJornadaName}
                    onChange={e => setNuevaJornadaName(e.target.value)}
                    placeholder="Ej. JORNADA 28-05"
                    className="w-full bg-[#0b111e] border border-[#1e2d4a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#60c0ea] uppercase font-bold transition-all disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">Cargar Archivo Excel (.xlsx)</label>
                  <div className="relative group border border-dashed border-[#1e2d4a] hover:border-[#60c0ea] bg-[#0b111e] p-6 rounded-xl text-center transition-all cursor-pointer">
                    <input
                      type="file"
                      disabled={loading}
                      accept=".xlsx"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="h-8 w-8 text-gray-500 group-hover:text-[#60c0ea] transition-colors" />
                      <span className="text-xs font-semibold text-gray-300">
                        {file ? file.name : 'Haz clic o arrastra tu archivo Excel'}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase">SÓLO ARCHIVOS .XLSX</span>
                    </div>
                  </div>
                </div>

                {loading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#60c0ea]">
                      <span className="flex items-center gap-1.5 uppercase">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progressMsg}
                      </span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0b111e] rounded-full overflow-hidden border border-[#1e2d4a]">
                      <div 
                        className="h-full bg-gradient-to-r from-[#60c0ea] to-[#004e74] transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !file || !nuevaJornadaName}
                  className="w-full bg-[#004e74] hover:bg-[#005e8c] text-white py-3 rounded-xl text-xs font-bold uppercase transition-all shadow-md shadow-[#004e74]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Procesando Carga...' : 'Crear & Cargar Jornada'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Jornadas List Table */}
          <div className="lg:col-span-2">
            <div className="bg-[#111a2e] border border-[#1e2d4a] p-6 rounded-2xl shadow-xl space-y-4">
              <h2 className="text-lg font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#60c0ea]" /> Historial de Jornadas
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e2d4a] text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Jornada</th>
                      <th className="py-3.5 px-4 text-center">Invitados</th>
                      <th className="py-3.5 px-4 text-center">Registrados</th>
                      <th className="py-3.5 px-4 text-center">Asist. Verificada</th>
                      <th className="py-3.5 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jornadas.map((j) => {
                      const isActive = activeJornada === j.nombre;
                      return (
                        <tr 
                          key={j.nombre} 
                          className={`border-b border-[#1e2d4a]/50 hover:bg-[#1a2640]/20 transition-all text-sm last:border-0 ${isActive ? 'bg-[#004e74]/10 border-l-2 border-l-[#60c0ea]' : ''}`}
                        >
                          <td className="py-4 px-4 font-bold text-white uppercase flex items-center gap-2">
                            {j.nombre}
                            {isActive && (
                              <span className="bg-[#60c0ea]/10 border border-[#60c0ea]/30 text-[#60c0ea] text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                ACTIVA
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-gray-300">
                            {j.totalInvitados}
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-emerald-400 font-bold">
                            {j.totalAsistieron}
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-purple-400 font-bold">
                            {j.totalVerificados}
                          </td>
                          <td className="py-4 px-4 flex items-center justify-center gap-2">
                            {!isActive && (
                              <button
                                disabled={loading}
                                onClick={() => handleSelectJornada(j.nombre)}
                                className="px-2.5 py-1 text-[10px] bg-[#004e74] hover:bg-[#005e8c] text-white rounded-lg font-bold uppercase transition-all"
                                title="Activar esta jornada"
                              >
                                Activar
                              </button>
                            )}
                            <button
                              disabled={loading || j.nombre === 'Jornada General'}
                              onClick={() => handleDeleteJornada(j.nombre)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={j.nombre === 'Jornada General' ? 'No se puede eliminar la Jornada General' : 'Eliminar Jornada'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {jornadas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500 italic text-sm">
                          No se encontraron jornadas en el historial.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
    </div>
  );
}
