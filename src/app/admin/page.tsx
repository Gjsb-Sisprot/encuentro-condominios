'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Database, Plus, Trash2, CheckCircle2, AlertTriangle, 
  RefreshCw, ClipboardList 
} from 'lucide-react';

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
  asistio: boolean;
  mesa_preasignada_id: string | null;
  whatsapp_status: string;
  whatsapp_error?: string;
  mesas_trabajo?: {
    numero: number;
    nombre: string;
  } | null;
}

interface DbAsistenteJoin {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string;
  condominio: string;
  municipio: string;
  asistio: boolean;
  mesa_preasignada_id: string | null;
  whatsapp_status: string;
  whatsapp_error: string | null;
  mesas_trabajo: {
    numero: number;
    nombre: string;
  } | null;
}

export default function AdminPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states for manual attendee
  const [nuevoAsistente, setNuevoAsistente] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    condominio: '',
    municipio: 'Mariño',
    mesa_preasignada_id: '',
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

      // Fetch Asistentes (joined with mesas)
      const { data: dataAsistentes, error: errorAsistentes } = await supabase
        .from('asistentes')
        .select(`
          id, nombre, cedula, telefono, condominio, municipio, asistio, 
          mesa_preasignada_id, whatsapp_status, whatsapp_error,
          mesas_trabajo (numero, nombre)
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
        asistio: item.asistio,
        mesa_preasignada_id: item.mesa_preasignada_id,
        whatsapp_status: item.whatsapp_status,
        whatsapp_error: item.whatsapp_error || undefined,
        mesas_trabajo: item.mesas_trabajo ? {
          numero: item.mesas_trabajo.numero,
          nombre: item.mesas_trabajo.nombre
        } : null
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

  const handleSeedDatabase = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // 1. Insert services
      const sampleServices = [
        { nombre: 'manto', descripcion: 'Mantenimiento preventivo e impermeabilización' },
        { nombre: 'ascensores', descripcion: 'Mantenimiento y reparación de ascensores' },
        { nombre: 'agua y plomería', descripcion: 'Sistemas de bombas, tuberías y distribución hídrica' },
        { nombre: 'asfalto', descripcion: 'Bacheo y vialidad interna' },
        { nombre: 'poda', descripcion: 'Control de áreas verdes y poda de árboles' },
        { nombre: 'iluminación', descripcion: 'Instalación y mantenimiento de luminarias' },
      ];
      const { error: errServ } = await supabase.from('servicios').upsert(sampleServices, { onConflict: 'nombre' });
      if (errServ) throw errServ;

      // 2. Insert mesas
      const sampleMesas = [
        { numero: 1, nombre: 'Mesa 1: Impermeabilización' },
        { numero: 2, nombre: 'Mesa 2: Ascensores' },
        { numero: 3, nombre: 'Mesa 3: Hídrica' },
        { numero: 4, nombre: 'Mesa 4: Asfalto' },
        { numero: 5, nombre: 'Mesa 5: Poda y tala' },
        { numero: 6, nombre: 'Mesa 6: Luminarias' },
      ];
      const { error: errMesas } = await supabase.from('mesas_trabajo').upsert(sampleMesas, { onConflict: 'numero' });
      if (errMesas) throw errMesas;

      // 3. Fetch newly inserted mesas and services to relate them
      const { data: dbMesas } = await supabase.from('mesas_trabajo').select('*');
      const { data: dbServ } = await supabase.from('servicios').select('*');

      if (dbMesas && dbServ) {
        const relations = [];
        // Relacionar cada mesa con su servicio principal de forma predeterminada
        const m1 = dbMesas.find(m => m.numero === 1);
        const m2 = dbMesas.find(m => m.numero === 2);
        const m3 = dbMesas.find(m => m.numero === 3);
        const m4 = dbMesas.find(m => m.numero === 4);
        const m5 = dbMesas.find(m => m.numero === 5);
        const m6 = dbMesas.find(m => m.numero === 6);

        const sManto = dbServ.find(s => s.nombre === 'manto');
        const sAsc = dbServ.find(s => s.nombre === 'ascensores');
        const sAgua = dbServ.find(s => s.nombre === 'agua y plomería');
        const sAsfalto = dbServ.find(s => s.nombre === 'asfalto');
        const sPoda = dbServ.find(s => s.nombre === 'poda');
        const sLuz = dbServ.find(s => s.nombre === 'iluminación');

        if (m1 && sManto) relations.push({ mesa_id: m1.id, servicio_id: sManto.id });
        if (m2 && sAsc) relations.push({ mesa_id: m2.id, servicio_id: sAsc.id });
        if (m3 && sAgua) relations.push({ mesa_id: m3.id, servicio_id: sAgua.id });
        if (m4 && sAsfalto) relations.push({ mesa_id: m4.id, servicio_id: sAsfalto.id });
        if (m5 && sPoda) relations.push({ mesa_id: m5.id, servicio_id: sPoda.id });
        if (m6 && sLuz) relations.push({ mesa_id: m6.id, servicio_id: sLuz.id });

        if (relations.length > 0) {
          await supabase.from('mesa_servicio').upsert(relations);
        }
      }

      // 4. Create sample attendees
      if (dbMesas && dbMesas.length > 0) {
        const m4 = dbMesas.find(m => m.numero === 4)?.id || dbMesas[0].id;
        const m5 = dbMesas.find(m => m.numero === 5)?.id || dbMesas[0].id;
        const m6 = dbMesas.find(m => m.numero === 6)?.id || dbMesas[0].id;        const sampleAsistentes = [
          { id: 'a2d9bb1a-081f-4197-ab50-93428c463532', nombre: 'Johanna Orlin Quintero López', cedula: '15532130', telefono: '0412-1482113', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 3D', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m6, asistio: false },
          { id: 'bfe08d82-91ea-4ab0-b694-4715db387398', nombre: 'Iris ledezma', cedula: '6960825', telefono: '0412-3821741', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 9C', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m6, asistio: false },
          { id: '09aaa2d5-d963-4e25-971a-228a2a9ff2bf', nombre: 'Francisca Mora', cedula: '5344377', telefono: '0414-4628509', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 3C', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m6, asistio: false },
          { id: 'c604e1a0-d8f7-4855-9289-5d93add67c6a', nombre: 'Alfonso Gabriel Duno Castrillo', cedula: '7004345', telefono: '0414-4164644', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 5D', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m6, asistio: false },
          { id: 'ba9902a4-e54e-47b5-9c49-fa0c91a12b6b', nombre: 'Rosa Linda Velásquez González', cedula: 'V-5.279.743', telefono: '0424-3288729', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 2B', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '7c25dc96-0f54-438b-8795-9f161ccbe323', nombre: 'Beccy Partida', cedula: 'V8744079', telefono: '0412-1482113', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II TORRE 2D', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: 'b4c2d98d-08c1-4b60-9534-0d7bafab55a5', nombre: 'MARIA GIL', cedula: 'V-7249693', telefono: '0424-3658402', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 1D', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '617257c0-5ecd-47ca-8c35-11137eb36f70', nombre: 'Reina roa', cedula: 'V10897383', telefono: '0424-3298133', condominio: 'Conjunto residencial el lago II Edificio 6B', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '3b3ec3c5-1d1d-4417-acc9-f186e336a200', nombre: 'José Luis Tovar', cedula: 'V-3.398.281', telefono: '0424-3447615', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II Edificio 2A', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '8a029496-c600-4602-b2af-2a1f0d4df63f', nombre: 'Stivaly Fattore', cedula: 'V20451000', telefono: '0424-3119473', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 8C', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '9ea8829b-de97-4a66-8496-2d386a9858b9', nombre: 'Mercedes Elena Rodrigu', cedula: '8740037', telefono: '0412-4307380', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 3F', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: 'e5f69a69-4225-4895-b897-d80c3a643794', nombre: 'Magalis Garcia', cedula: '4555713', telefono: '0412-3554165', condominio: 'Conjunto Residencial El Lago II Edificio 4F', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '223b4628-62d4-4c14-8e7f-ab0f5ccfff05', nombre: 'Luis Arenas', cedula: 'V9621800', telefono: '0426-5145220', condominio: 'Conjunto Residencial El Lago II Edificio 4B', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: 'e2d5feb1-d635-4b7b-824f-8a02689b1fad', nombre: 'Nacari Torres', cedula: '12140240', telefono: '0412-4569851', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 1F', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: 'cf82625b-27dc-41d2-bdc3-19f08b4450bf', nombre: 'Susana Pérez', cedula: 'V-19277791', telefono: '0412-5334747', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 2E', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '1dff0fa3-f41d-40d7-8823-34dac0dc0fe6', nombre: 'María Ramos', cedula: '10694505', telefono: '0414-3532884', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 9E', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '209c7ab9-0984-4c1a-9ed6-6a95b822b1a7', nombre: 'Vivian yuraima claro nuñez', cedula: '13701272', telefono: '0424-3097701', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 7E', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m4, asistio: false },
          { id: '4b654f87-3b60-4917-aa89-028bf3c3a7da', nombre: 'Gladys Hernandez', cedula: 'V6935752', telefono: '0414-4900676', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 1-E', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m4, asistio: false },
          { id: 'b68d0777-e47c-460e-81cc-ec2e7dfead88', nombre: 'Damarys González', cedula: '15286066', telefono: '0412-8920536', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 6D', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '7e88a3e7-9590-4c28-84d8-917942a0c71a', nombre: 'Ana arana', cedula: 'V-4856018', telefono: '0424-2332653', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 9D', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m5, asistio: false },
          { id: '8c8a2f7b-7872-489f-bc69-5a61e9054ce2', nombre: 'Roxana Gómez', cedula: 'V14354296', telefono: '0412-4871616', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 5E', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: null, asistio: false },
          { id: '61245f11-feb6-4b2e-8e5e-fa112cdadce4', nombre: 'WENDY RANGEL', cedula: 'V11982144', telefono: '0416-5437641', condominio: 'CONJUNTO RESIDENCIAL EL LAGO II EDIFICIO 7-D', municipio: 'Girardot', estado: 'Aragua', parroquia: 'José Casanova Godoy', mesa_preasignada_id: m4, asistio: false }
        ];

        const { error: errAsis } = await supabase.from('asistentes').upsert(sampleAsistentes, { onConflict: 'cedula' });
        if (errAsis) throw errAsis;
      }

      setSuccessMsg('Base de datos inicializada con éxito con las 6 mesas oficiales y presidentes de prueba.');
      fetchData();
    } catch (err) {
      console.error(err);
      const errorObj = err as Error;
      setErrorMsg(errorObj.message || 'Error al sembrar la base de datos.');
    } finally {
      setLoading(false);
    }
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

      const payload = {
        nombre: nuevoAsistente.nombre,
        cedula: nuevoAsistente.cedula,
        telefono: nuevoAsistente.telefono,
        condominio: nuevoAsistente.condominio,
        municipio: nuevoAsistente.municipio,
        mesa_preasignada_id: nuevoAsistente.mesa_preasignada_id || null,
        asistio: false,
      };

      const { error } = await supabase.from('asistentes').insert([payload]);
      if (error) throw error;

      setSuccessMsg(`Presidente ${nuevoAsistente.nombre} registrado con éxito.`);
      setNuevoAsistente({
        nombre: '',
        cedula: '',
        telefono: '',
        condominio: '',
        municipio: 'Mariño',
        mesa_preasignada_id: '',
      });
      fetchData();
    } catch (err) {
      console.error(err);
      const errorObj = err as Error;
      setErrorMsg(errorObj.message || 'Error al crear asistente.');
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

      {/* Caja de herramientas de configuración rápida */}
      {mesas.length === 0 && (
        <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#004e74]/20 flex items-center justify-center text-[#60c0ea] shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">La base de datos está vacía</h3>
              <p className="text-gray-400 text-sm mt-1 max-w-xl">
                Inicializa la base de datos con los servicios iniciales, las 4 mesas de trabajo temáticas y una lista semilla de presidentes de condominio de prueba para comenzar a probar el flujo de asistencia.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedDatabase}
            disabled={loading}
            className="w-full md:w-auto px-6 py-3 font-semibold text-sm rounded-xl bg-[#004e74] text-white hover:bg-[#004e74]/80 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Database className="h-4 w-4" /> Inicializar Datos Prueba
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario para agregar asistente manualmente */}
        <div className="lg:col-span-1 bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-[#1e2d4a] pb-3">
            <Plus className="h-5 w-5 text-[#60c0ea]" /> Registrar Nuevo Invitado
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
                onChange={e => setNuevoAsistente({ ...nuevoAsistente, municipio: e.target.value })}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
              >
                <option value="Mariño">Mariño</option>
                <option value="Maneiro">Maneiro</option>
                <option value="García">García</option>
                <option value="Arismendi">Arismendi</option>
                <option value="Díaz">Díaz</option>
                <option value="Tubores">Tubores</option>
                <option value="Península de Macanao">Península de Macanao</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Mesa Preasignada</label>
              <select
                value={nuevoAsistente.mesa_preasignada_id}
                onChange={e => setNuevoAsistente({ ...nuevoAsistente, mesa_preasignada_id: e.target.value })}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
              >
                <option value="">Ninguna (Asignación automática)</option>
                {mesas.map(m => (
                  <option key={m.id} value={m.id}>Mesa {m.numero} ({m.nombre})</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-[#004e74] hover:bg-[#004e74]/80 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              Registrar Presidente
            </button>
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
                  <th className="py-3 px-2">Mesa Preasignada</th>
                  <th className="py-3 px-2">Asistió</th>
                  <th className="py-3 px-2">Notificación WA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {asistentes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No hay ningún asistente en la base de datos.
                    </td>
                  </tr>
                ) : (
                  asistentes.map(a => (
                    <tr key={a.id} className="hover:bg-[#15223e] transition-colors">
                      <td className="py-3 px-2 font-mono font-medium">{a.cedula}</td>
                      <td className="py-3 px-2">
                        <div className="font-semibold text-white">{a.nombre}</div>
                        <div className="text-xs text-gray-400">{a.municipio} | {a.telefono}</div>
                      </td>
                      <td className="py-3 px-2 max-w-[150px] truncate">{a.condominio}</td>
                      <td className="py-3 px-2 text-xs">
                        {a.mesas_trabajo ? (
                          <span className="px-2 py-1 rounded bg-[#004e74]/20 border border-[#004e74]/40 text-[#60c0ea]">
                            Mesa {a.mesas_trabajo.numero}
                          </span>
                        ) : (
                          <span className="text-gray-500">No asignada</span>
                        )}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
