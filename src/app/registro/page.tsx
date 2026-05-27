'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { evolutionService } from '@/lib/evolution-api';
import { findAsistenteByCedula } from '@/lib/asistentes';
import { cleanCedula, cleanTelefono } from '@/lib/utils';
import { 
  Search, CheckCircle2, UserCheck, MessageSquare, 
  MapPin, AlertCircle, Loader2 
} from 'lucide-react';
import { animate } from 'animejs';

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

interface MesaInfo {
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
  parroquia?: string | null;
  asistio: boolean;
  es_acompanante?: boolean;
  es_directivo?: boolean;
  cargo_directivo?: string | null;
  mesas_preasignadas: MesaInfo[];
}

interface DbMesaResponse {
  id: string;
  numero: number;
  nombre: string;
}

interface DbSearchResponse {
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
  asistente_mesa: {
    mesa_id: string;
    mesas_trabajo: {
      id: string;
      numero: number;
      nombre: string;
    } | null;
  }[];
}

interface CompanionInput {
  nombre: string;
  cedula: string;
  telefono: string;
  mesa_id: string;
  es_directivo: boolean;
  cargo_directivo: string;
}

export default function RegistroPage() {
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data lists
  const [mesas, setMesas] = useState<DbMesaResponse[]>([]);
  
  // Step workflow states
  const [foundGuest, setFoundGuest] = useState<AsistenteInfo | null>(null);
  const [showMesaSelection, setShowMesaSelection] = useState(false);
  const [selectedMesaIds, setSelectedMesaIds] = useState<string[]>([]);
  const [isRegisteringNewGuest, setIsRegisteringNewGuest] = useState(false);
  const [nuevoGuest, setNuevoGuest] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    condominio: '',
    municipio: 'Girardot',
    parroquia: 'José Casanova Godoy',
    es_acompanante: false,
    es_directivo: false,
    cargo_directivo: '',
  });
  const [editingGuestData, setEditingGuestData] = useState({
    nombre: '',
    telefono: '',
    condominio: '',
    municipio: 'Girardot',
    parroquia: 'José Casanova Godoy',
    es_acompanante: false,
    es_directivo: false,
    cargo_directivo: '',
  });
  
  // Companions state
  const [hasCompanions, setHasCompanions] = useState(false);
  const [companions, setCompanions] = useState<CompanionInput[]>([]);
  
  // Registration result states
  const [registrado, setRegistrado] = useState(false);
  const [asistenteInfo, setAsistenteInfo] = useState<AsistenteInfo | null>(null);
  const [mesaAsignadaText, setMesaAsignadaText] = useState<string>('');
  const [waStatus, setWaStatus] = useState<{ success: boolean; msg: string } | null>(null);
  
  // Animation refs
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Fetch mesas on load
  useEffect(() => {
    async function fetchMesas() {
      const { data, error } = await supabase
        .from('mesas_trabajo')
        .select('*')
        .order('numero', { ascending: true });
      if (data) {
        setMesas(data as DbMesaResponse[]);
      }
      if (error) {
        console.error('Error fetching mesas:', error);
      }
    }
    fetchMesas();
  }, []);

  const REGISTRO_SELECT = `
    id, nombre, cedula, telefono, condominio, municipio, parroquia, asistio,
    es_acompanante, es_directivo, cargo_directivo,
    asistente_mesa (
      mesa_id,
      mesas_trabajo (id, numero, nombre)
    )
  `;

  const mapGuestFromDb = (rawGuest: DbSearchResponse): AsistenteInfo => ({
    id: rawGuest.id,
    nombre: rawGuest.nombre,
    cedula: rawGuest.cedula,
    telefono: rawGuest.telefono,
    condominio: rawGuest.condominio,
    municipio: rawGuest.municipio,
    parroquia: rawGuest.parroquia,
    asistio: rawGuest.asistio,
    es_acompanante: rawGuest.es_acompanante || false,
    es_directivo: rawGuest.es_directivo || false,
    cargo_directivo: rawGuest.cargo_directivo,
    mesas_preasignadas: (rawGuest.asistente_mesa || [])
      .map(am => am.mesas_trabajo)
      .filter((m): m is MesaInfo => m !== null),
  });

  const loadGuestForRegistration = (guest: AsistenteInfo) => {
    setFoundGuest(guest);
    setEditingGuestData({
      nombre: guest.nombre,
      telefono: guest.telefono || '',
      condominio: guest.condominio,
      municipio: guest.municipio,
      parroquia: guest.parroquia || 'José Casanova Godoy',
      es_acompanante: guest.es_acompanante || false,
      es_directivo: guest.es_directivo || false,
      cargo_directivo: guest.cargo_directivo || '',
    });
    setSelectedMesaIds(guest.mesas_preasignadas.map(m => m.id));
    setShowMesaSelection(true);
    setIsRegisteringNewGuest(false);
    setErrorMsg('');
  };

  // Search by Cédula
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanCedula(cedula);
    if (!cleaned) return;

    setLoading(true);
    setErrorMsg('');
    setRegistrado(false);
    setFoundGuest(null);
    setShowMesaSelection(false);
    setWaStatus(null);
    setHasCompanions(false);
    setCompanions([]);
    setIsRegisteringNewGuest(false);

    try {
      const { data: matchedGuest, error: searchError } = await findAsistenteByCedula<DbSearchResponse>(
        supabase,
        cedula,
        REGISTRO_SELECT
      );

      if (searchError) throw searchError;

      if (!matchedGuest) {
        setErrorMsg('Esta cédula no se encuentra registrada en la lista oficial de invitados. ¿Deseas registrarla ahora?');
        setLoading(false);
        return;
      }

      const guest = mapGuestFromDb(matchedGuest);

      if (!guest.asistio) {
        const { error: attendanceError } = await supabase
          .from('asistentes')
          .update({
            asistio: true,
            fecha_registro: new Date().toISOString(),
          })
          .eq('id', guest.id);

        if (attendanceError) throw attendanceError;
      }

      loadGuestForRegistration({
        ...guest,
        asistio: true,
      });
    } catch (error) {
      console.error(error);
      setErrorMsg('Error al buscar el participante.');
    } finally {
      setLoading(false);
    }
  };

  // Get available tables for companion idx dynamically
  const getAvailableMesasForCompanion = (currentIdx: number) => {
    if (!foundGuest) return [];
    // If the president has preassigned tables, companions can only be assigned to those.
    // If the president has NO preassigned tables, companions can be assigned to ANY table.
    let available = foundGuest.mesas_preasignadas.length > 0 
      ? [...foundGuest.mesas_preasignadas] 
      : [...mesas];
    // Filter out mesas selected by the president
    available = available.filter(m => !selectedMesaIds.includes(m.id));
    // Filter out mesas selected by other companions
    companions.forEach((comp, i) => {
      if (i !== currentIdx && comp.mesa_id) {
        available = available.filter(m => m.id !== comp.mesa_id);
      }
    });

    // Fallback: If no tables are available under the preassigned restriction, allow selecting ANY table in the database
    // that is not currently selected by the president or other companions.
    if (available.length === 0) {
      available = [...mesas].filter(m => !selectedMesaIds.includes(m.id));
      companions.forEach((comp, i) => {
        if (i !== currentIdx && comp.mesa_id) {
          available = available.filter(m => m.id !== comp.mesa_id);
        }
      });
    }

    return available;
  };

  const handleAddCompanion = () => {
    setCompanions([
      ...companions,
      {
        nombre: '',
        cedula: '',
        telefono: '',
        mesa_id: '',
        es_directivo: false,
        cargo_directivo: ''
      }
    ]);
  };

  const handleRemoveCompanion = (index: number) => {
    setCompanions(companions.filter((_, i) => i !== index));
  };

  const handleCompanionChange = (index: number, field: keyof CompanionInput, value: string | boolean) => {
    const updated = [...companions];
    updated[index] = { ...updated[index], [field]: value } as CompanionInput;
    setCompanions(updated);
  };

  // Confirm registration
  const handleConfirmRegistration = async () => {
    if (!foundGuest) return;
    if (selectedMesaIds.length === 0 && (!hasCompanions || companions.length === 0)) {
      setErrorMsg('El presidente debe seleccionar al menos una mesa, o registrar acompañantes en las mesas asignadas.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Update President attendance and guest info
      const { error: updateError } = await supabase
        .from('asistentes')
        .update({
          nombre: editingGuestData.nombre,
          telefono: cleanTelefono(editingGuestData.telefono),
          condominio: editingGuestData.condominio,
          municipio: editingGuestData.municipio,
          parroquia: editingGuestData.parroquia,
          es_acompanante: editingGuestData.es_acompanante,
          es_directivo: editingGuestData.es_acompanante ? editingGuestData.es_directivo : false,
          cargo_directivo: (editingGuestData.es_acompanante && editingGuestData.es_directivo) ? editingGuestData.cargo_directivo : null,
          asistio: true,
          fecha_registro: new Date().toISOString(),
        })
        .eq('id', foundGuest.id);

      if (updateError) throw updateError;

      // 2. Clear old mesa relationships for president and re-insert chosen ones
      await supabase.from('asistente_mesa').delete().eq('asistente_id', foundGuest.id);
      if (selectedMesaIds.length > 0) {
        const rels = selectedMesaIds.map(mId => ({
          asistente_id: foundGuest.id,
          mesa_id: mId
        }));
        const { error: insertRelsError } = await supabase.from('asistente_mesa').insert(rels);
        if (insertRelsError) throw insertRelsError;
      }

      // 3. Register Companions
      if (hasCompanions && companions.length > 0) {
        for (const comp of companions) {
          if (!comp.nombre || !comp.cedula || !comp.telefono || !comp.mesa_id) {
            throw new Error(`Por favor, complete todos los datos requeridos del acompañante: ${comp.nombre || 'Sin nombre'}.`);
          }

          // Insert companion row
          const compPayload = {
            nombre: comp.nombre,
            cedula: cleanCedula(comp.cedula),
            telefono: cleanTelefono(comp.telefono),
            condominio: foundGuest.condominio,
            municipio: foundGuest.municipio,
            parroquia: foundGuest.parroquia,
            asistio: true,
            es_acompanante: true,
            invitado_por_id: foundGuest.id,
            es_directivo: comp.es_directivo,
            cargo_directivo: comp.es_directivo ? comp.cargo_directivo : null,
            fecha_registro: new Date().toISOString()
          };

          const { data: insertedComp, error: compErr } = await supabase
            .from('asistentes')
            .insert([compPayload])
            .select('id');

          if (compErr) throw compErr;
          if (!insertedComp || insertedComp.length === 0) throw new Error('Error al registrar acompañante.');

          const companionId = insertedComp[0].id;

          // Insert companion mesa relationship
          const { error: compRelErr } = await supabase
            .from('asistente_mesa')
            .insert([{
              asistente_id: companionId,
              mesa_id: comp.mesa_id
            }]);
          if (compRelErr) throw compRelErr;

          // Send WhatsApp to Companion
          const chosenMesa = mesas.find(m => m.id === comp.mesa_id);
          const companionMessage = `Hola, *${comp.nombre}*;

Bienvenido a la *MESA DE LOS SERVICIOS PÚBLICOS CONDOMINIALES DEL MUNICIPIO GIRARDOT*

En nombre de nuestra Gobernadora Joana Sánchez queremos darte la cordial bienvenida. 

📌 Has sido asignado a la:
*${chosenMesa?.nombre || 'Mesa de Trabajo'}*

Tu participación como acompañante y representante de la comunidad *${foundGuest.condominio}* es sumamente valiosa para nosotros.

Sin duda alguna, ¡Aragua nos une, y siempre nos vamos a encontrar! Eres Gente de Bien, HACIÉNDOLO BIEN! 🚀

_Nota: Número para solo envío de mensajería masiva - No recibe respuestas_`;

          const waResultComp = await evolutionService.sendWhatsAppMessage(comp.telefono, companionMessage);
          if (waResultComp.success) {
            await supabase.from('asistentes').update({ whatsapp_status: 'enviado' }).eq('id', companionId);
          } else {
            await supabase.from('asistentes').update({ whatsapp_status: 'error', whatsapp_error: waResultComp.error }).eq('id', companionId);
          }
        }
      }

      // Format mesas text for confirmation screen
      const selectedMesasData = mesas.filter(m => selectedMesaIds.includes(m.id));
      const mesasString = selectedMesasData.map(m => m.nombre).join(', ');
      setMesaAsignadaText(mesasString || 'Delegado en Acompañantes');

      const updatedGuest = {
        ...foundGuest,
        nombre: editingGuestData.nombre,
        telefono: cleanTelefono(editingGuestData.telefono),
        condominio: editingGuestData.condominio,
        municipio: editingGuestData.municipio,
        parroquia: editingGuestData.parroquia,
        es_acompanante: editingGuestData.es_acompanante,
        es_directivo: editingGuestData.es_acompanante ? editingGuestData.es_directivo : false,
        cargo_directivo: editingGuestData.cargo_directivo,
        asistio: true
      };
      setAsistenteInfo(updatedGuest);
      setShowMesaSelection(false);
      setRegistrado(true);

      // Send WhatsApp to President
      if (updatedGuest.telefono && selectedMesaIds.length > 0) {
        const mesasStringWA = selectedMesasData.map(m => `*${m.nombre}*`).join('\n');
        const customMessage = `Hola, *${updatedGuest.nombre}*;

Bienvenido a la *MESA DE LOS SERVICIOS PÚBLICOS CONDOMINIALES DEL MUNICIPIO GIRARDOT*

En nombre de nuestra Gobernadora Joana Sánchez queremos darte la cordial bienvenida. 

📌 Has sido asignado a:
${mesasStringWA}

Tu participación en representación de la comunidad *${updatedGuest.condominio}* es sumamente valiosa para nosotros.

Sin duda alguna, ¡Aragua nos une, y siempre nos vamos a encontrar! Eres Gente de Bien, HACIÉNDOLO BIEN! 🚀

_Nota: Número para solo envío de mensajería masiva - No recibe respuestas_`;

        setWaStatus({ success: false, msg: 'Enviando mensaje de confirmación al presidente...' });
        const waResult = await evolutionService.sendWhatsAppMessage(updatedGuest.telefono, customMessage);

        if (waResult.success) {
          setWaStatus({ success: true, msg: 'Mensaje de WhatsApp enviado con éxito' });
          await supabase
            .from('asistentes')
            .update({ whatsapp_status: 'enviado' })
            .eq('id', updatedGuest.id);
        } else {
          setWaStatus({ success: false, msg: `No se pudo enviar el WhatsApp: ${waResult.error}` });
          await supabase
            .from('asistentes')
            .update({ 
              whatsapp_status: 'error',
              whatsapp_error: waResult.error
            })
            .eq('id', updatedGuest.id);
        }
      } else {
        setWaStatus({ success: false, msg: 'Presidente registrado. Sin envío de WhatsApp (no seleccionó mesa o no posee teléfono).' });
      }

    } catch (error) {
      console.error(error);
      const err = error as Error;
      setErrorMsg(err.message || 'Ocurrió un error durante la confirmación.');
    } finally {
      setLoading(false);
    }
  };

  // AnimeJS Micro-interactions
  useEffect(() => {
    if (registrado && cardRef.current) {
      animate(cardRef.current, {
        scale: [0.95, 1],
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 800,
        easing: 'easeOutElastic(1, .6)'
      });
    }
  }, [registrado]);

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      {/* Encabezado */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-[#004e74]/20 text-[#60c0ea] mb-3">
          <UserCheck className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Registro de Asistencia</h1>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          Ingresa la Cédula de Identidad del presidente de condominio para registrar su asistencia y confirmar la mesa de trabajo en la que participará.
        </p>
      </div>

      {/* Paso 1: Formulario de búsqueda */}
      {!registrado && !showMesaSelection && (
        <form 
          ref={formRef}
          onSubmit={handleSearch} 
          className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 shadow-xl space-y-6 animate-slide-up"
        >
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
              Número de Cédula de Identidad
            </label>
            <div className="relative">
              <input
                type="text"
                required
                disabled={loading}
                value={cedula}
                onChange={e => setCedula(e.target.value)}
                placeholder="Ingresa cédula (Ej. 12345678)"
                className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white text-lg font-mono rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-[#60c0ea] focus:ring-1 focus:ring-[#60c0ea] transition-all disabled:opacity-50"
              />
              <Search className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !cedula.trim()}
            className="w-full py-4 bg-[#004e74] hover:bg-[#004e74]/80 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#004e74]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Buscando Participante...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Buscar Invitado
              </>
            )}
          </button>

          {errorMsg && (
            <div className="space-y-4">
              <div className="p-4 bg-red-950/20 border border-red-900/50 text-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-bold block">Participante no encontrado</span>
                  <span>{errorMsg}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNuevoGuest({
                    nombre: '',
                    cedula: cleanCedula(cedula),
                    telefono: '',
                    condominio: '',
                    municipio: 'Girardot',
                    parroquia: 'José Casanova Godoy',
                    es_acompanante: false,
                    es_directivo: false,
                    cargo_directivo: '',
                  });
                  setSelectedMesaIds([]);
                  setIsRegisteringNewGuest(true);
                  setErrorMsg('');
                }}
                className="w-full py-3 bg-[#111a2e] border border-[#60c0ea]/40 hover:border-[#60c0ea] text-[#60c0ea] hover:text-white font-bold rounded-xl transition-all text-sm"
              >
                + Registrar nuevo invitado e iniciar asistencia
              </button>
            </div>
          )}
        </form>
      )}

      {/* Registro de Nuevo Invitado */}
      {isRegisteringNewGuest && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nuevoGuest.nombre || !nuevoGuest.cedula || !nuevoGuest.telefono || !nuevoGuest.condominio) {
              setErrorMsg('Todos los campos obligatorios deben completarse.');
              return;
            }
            if (selectedMesaIds.length === 0) {
              setErrorMsg('Debe seleccionar al menos una mesa de trabajo.');
              return;
            }
            setLoading(true);
            setErrorMsg('');
            try {
              const payload = {
                nombre: nuevoGuest.nombre,
                cedula: cleanCedula(nuevoGuest.cedula),
                telefono: cleanTelefono(nuevoGuest.telefono),
                condominio: nuevoGuest.condominio,
                municipio: nuevoGuest.municipio,
                parroquia: nuevoGuest.parroquia,
                es_acompanante: nuevoGuest.es_acompanante,
                es_directivo: nuevoGuest.es_acompanante ? nuevoGuest.es_directivo : false,
                cargo_directivo: (nuevoGuest.es_acompanante && nuevoGuest.es_directivo) ? nuevoGuest.cargo_directivo : null,
                asistio: true,
                fecha_registro: new Date().toISOString(),
              };

              const { data: insertedData, error: insertError } = await supabase
                .from('asistentes')
                .insert([payload])
                .select('id');

              if (insertError) throw insertError;
              if (!insertedData || insertedData.length === 0) throw new Error('No se pudo recuperar el ID del nuevo asistente.');

              const newId = insertedData[0].id;

              const relations = selectedMesaIds.map(mesaId => ({
                asistente_id: newId,
                mesa_id: mesaId
              }));
              const { error: relError } = await supabase
                .from('asistente_mesa')
                .insert(relations);
              if (relError) throw relError;

              // WhatsApp message format and dispatch
              const selectedMesasData = mesas.filter(m => selectedMesaIds.includes(m.id));
              const mesasString = selectedMesasData.map(m => m.nombre).join(', ');
              setMesaAsignadaText(mesasString);

              const guestInfoFormatted: AsistenteInfo = {
                id: newId,
                nombre: nuevoGuest.nombre,
                cedula: cleanCedula(nuevoGuest.cedula),
                telefono: cleanTelefono(nuevoGuest.telefono),
                condominio: nuevoGuest.condominio,
                municipio: nuevoGuest.municipio,
                parroquia: nuevoGuest.parroquia,
                asistio: true,
                es_acompanante: nuevoGuest.es_acompanante,
                es_directivo: nuevoGuest.es_acompanante ? nuevoGuest.es_directivo : false,
                cargo_directivo: nuevoGuest.cargo_directivo,
                mesas_preasignadas: selectedMesasData,
              };

              setAsistenteInfo(guestInfoFormatted);
              setIsRegisteringNewGuest(false);
              setRegistrado(true);

              if (guestInfoFormatted.telefono) {
                const mesasStringWA = selectedMesasData.map(m => `*${m.nombre}*`).join('\n');
                const customMessage = `Hola, *${guestInfoFormatted.nombre}*;

Bienvenido a la *MESA DE LOS SERVICIOS PÚBLICOS CONDOMINIALES DEL MUNICIPIO GIRARDOT*

En nombre de nuestra Gobernadora Joana Sánchez queremos darte la cordial bienvenida. 

📌 Has sido asignado a:
${mesasStringWA}

Tu participación en representación de la comunidad *${guestInfoFormatted.condominio}* es sumamente valiosa para nosotros.

Sin duda alguna, ¡Aragua nos une, y siempre nos vamos a encontrar! Eres Gente de Bien, HACIÉNDOLO BIEN! 🚀

_Nota: Número para solo envío de mensajería masiva - No recibe respuestas_`;

                setWaStatus({ success: false, msg: 'Enviando mensaje de confirmación al presidente...' });
                const waResult = await evolutionService.sendWhatsAppMessage(guestInfoFormatted.telefono, customMessage);

                if (waResult.success) {
                  setWaStatus({ success: true, msg: 'Mensaje de WhatsApp enviado con éxito' });
                  await supabase
                    .from('asistentes')
                    .update({ whatsapp_status: 'enviado' })
                    .eq('id', newId);
                } else {
                  setWaStatus({ success: false, msg: `No se pudo enviar el WhatsApp: ${waResult.error}` });
                  await supabase
                    .from('asistentes')
                    .update({ 
                      whatsapp_status: 'error',
                      whatsapp_error: waResult.error
                    })
                    .eq('id', newId);
                }
              }
            } catch (err) {
              console.error(err);
              const errorObj = err as Error;
              setErrorMsg(errorObj.message || 'Error al registrar al asistente.');
            } finally {
              setLoading(false);
            }
          }}
          className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 shadow-xl space-y-6 animate-slide-up"
        >
          {/* Header */}
          <div className="border-b border-[#1e2d4a] pb-4">
            <span className="text-xs font-semibold text-[#60c0ea] uppercase tracking-wider block">Registrar Invitado Inexistente</span>
            <h2 className="text-xl font-bold text-white mt-1">Nuevo Registro y Asistencia</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nombre Completo *</label>
              <input
                type="text"
                required
                value={nuevoGuest.nombre}
                onChange={e => setNuevoGuest({ ...nuevoGuest, nombre: e.target.value })}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                placeholder="Nombre del asistente"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cédula de Identidad *</label>
              <input
                type="text"
                required
                disabled
                value={nuevoGuest.cedula}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-gray-400 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Teléfono (WhatsApp) *</label>
              <input
                type="text"
                required
                value={nuevoGuest.telefono}
                onChange={e => setNuevoGuest({ ...nuevoGuest, telefono: e.target.value })}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                placeholder="Ej. 04141234567"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nombre del Condominio *</label>
              <input
                type="text"
                required
                value={nuevoGuest.condominio}
                onChange={e => setNuevoGuest({ ...nuevoGuest, condominio: e.target.value })}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                placeholder="Ej. Condominio El Paraíso"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Municipio *</label>
              <select
                value={nuevoGuest.municipio}
                onChange={e => {
                  const newMuni = e.target.value;
                  const defaultParroquia = PARROQUIAS_POR_MUNICIPIO[newMuni]?.[0] || '';
                  setNuevoGuest({ 
                    ...nuevoGuest, 
                    municipio: newMuni,
                    parroquia: defaultParroquia
                  });
                }}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
              >
                {Object.keys(PARROQUIAS_POR_MUNICIPIO).map(muni => (
                  <option key={muni} value={muni}>{muni}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Parroquia *</label>
              <select
                value={nuevoGuest.parroquia}
                onChange={e => setNuevoGuest({ ...nuevoGuest, parroquia: e.target.value })}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
              >
                {(PARROQUIAS_POR_MUNICIPIO[nuevoGuest.municipio] || []).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Opción de Cargo / Rol */}
          <div className="space-y-3 pt-2 border-t border-[#1e2d4a]">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cargo / Tipo de Invitado *</label>
              <select
                value={
                  nuevoGuest.es_acompanante 
                    ? (nuevoGuest.es_directivo ? 'directivo' : 'acompanante')
                    : 'presidente'
                }
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'presidente') {
                    setNuevoGuest({ ...nuevoGuest, es_acompanante: false, es_directivo: false, cargo_directivo: '' });
                  } else if (val === 'acompanante') {
                    setNuevoGuest({ ...nuevoGuest, es_acompanante: true, es_directivo: false, cargo_directivo: '' });
                  } else if (val === 'directivo') {
                    setNuevoGuest({ ...nuevoGuest, es_acompanante: true, es_directivo: true, cargo_directivo: '' });
                  }
                }}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
              >
                <option value="presidente">Presidente de Condominio</option>
                <option value="directivo">Directivo del Condominio</option>
                <option value="acompanante">Acompañante / Invitado</option>
              </select>
            </div>

            {nuevoGuest.es_directivo && (
              <div className="space-y-3 animate-slide-up">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cargo Directivo Especifico *</label>
                  <input
                    type="text"
                    required
                    value={nuevoGuest.cargo_directivo}
                    onChange={e => setNuevoGuest({ ...nuevoGuest, cargo_directivo: e.target.value })}
                    className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                    placeholder="Ej. Vocal, Tesorero, Administrador, etc."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mesas */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Asignar Mesa de Trabajo *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#1a2640] p-4 rounded-xl border border-[#1e2d4a] max-h-48 overflow-y-auto">
              {mesas.map(m => {
                const isChecked = selectedMesaIds.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-3 text-xs text-gray-300 hover:text-white cursor-pointer py-1 px-2 rounded hover:bg-[#111a2e] transition-colors">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setSelectedMesaIds(selectedMesaIds.filter(id => id !== m.id));
                        } else {
                          setSelectedMesaIds([...selectedMesaIds, m.id]);
                        }
                      }}
                      className="rounded border-[#1e2d4a] bg-[#111a2e] text-[#60c0ea] focus:ring-0 focus:ring-offset-0"
                    />
                    <span>{m.nombre}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-200 rounded-xl flex items-start gap-2.5 text-xs">
              <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsRegisteringNewGuest(false);
                setCedula('');
                setErrorMsg('');
              }}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-all text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-1.5"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Registrando...' : 'Confirmar Registro'}
            </button>
          </div>
        </form>
      )}

      {/* Paso 2: Selección y Confirmación de Mesa / Acompañantes */}
      {showMesaSelection && foundGuest && (
        <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 shadow-xl space-y-6 animate-slide-up">
          <div className="border-b border-[#1e2d4a] pb-4 space-y-4">
            <span className="text-xs font-semibold text-[#60c0ea] uppercase tracking-wider block">Verificar y Modificar Datos del Participante</span>
            
            {foundGuest.asistio && (
              <div className="p-4 bg-amber-950/20 border border-amber-900/50 text-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-bold block">⚠️ Asistencia ya Registrada</span>
                  <span>Este participante ya registró su asistencia anteriormente. Puedes modificar sus datos o mesas si lo deseas.</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={editingGuestData.nombre}
                  onChange={e => setEditingGuestData({ ...editingGuestData, nombre: e.target.value })}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cédula de Identidad</label>
                <input
                  type="text"
                  disabled
                  value={foundGuest.cedula}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-gray-400 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Teléfono *</label>
                <input
                  type="text"
                  required
                  value={editingGuestData.telefono}
                  onChange={e => setEditingGuestData({ ...editingGuestData, telefono: e.target.value })}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Condominio *</label>
                <input
                  type="text"
                  required
                  value={editingGuestData.condominio}
                  onChange={e => setEditingGuestData({ ...editingGuestData, condominio: e.target.value })}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Municipio *</label>
                <select
                  value={editingGuestData.municipio}
                  onChange={e => {
                    const newMuni = e.target.value;
                    const defaultParroquia = PARROQUIAS_POR_MUNICIPIO[newMuni]?.[0] || '';
                    setEditingGuestData({ 
                      ...editingGuestData, 
                      municipio: newMuni,
                      parroquia: defaultParroquia
                    });
                  }}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                >
                  {Object.keys(PARROQUIAS_POR_MUNICIPIO).map(muni => (
                    <option key={muni} value={muni}>{muni}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Parroquia *</label>
                <select
                  value={editingGuestData.parroquia}
                  onChange={e => setEditingGuestData({ ...editingGuestData, parroquia: e.target.value })}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                >
                  {(PARROQUIAS_POR_MUNICIPIO[editingGuestData.municipio] || []).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Opción de Cargo / Rol */}
            <div className="space-y-3 pt-2 border-t border-[#1e2d4a]">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cargo / Tipo de Invitado *</label>
                <select
                  value={
                    editingGuestData.es_acompanante 
                      ? (editingGuestData.es_directivo ? 'directivo' : 'acompanante')
                      : 'presidente'
                  }
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'presidente') {
                      setEditingGuestData({ ...editingGuestData, es_acompanante: false, es_directivo: false, cargo_directivo: '' });
                    } else if (val === 'acompanante') {
                      setEditingGuestData({ ...editingGuestData, es_acompanante: true, es_directivo: false, cargo_directivo: '' });
                    } else if (val === 'directivo') {
                      setEditingGuestData({ ...editingGuestData, es_acompanante: true, es_directivo: true, cargo_directivo: '' });
                    }
                  }}
                  className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                >
                  <option value="presidente">Presidente de Condominio</option>
                  <option value="directivo">Directivo del Condominio</option>
                  <option value="acompanante">Acompañante / Invitado</option>
                </select>
              </div>

              {editingGuestData.es_directivo && (
                <div className="space-y-3 animate-slide-up">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cargo Directivo Especifico *</label>
                    <input
                      type="text"
                      required
                      value={editingGuestData.cargo_directivo}
                      onChange={e => setEditingGuestData({ ...editingGuestData, cargo_directivo: e.target.value })}
                      className="w-full bg-[#1a2640] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#60c0ea]"
                      placeholder="Ej. Vocal, Tesorero, Administrador, etc."
                    />
                  </div>
                </div>
              )}
            </div>
        </div>

          <div className="space-y-6">
            {/* Mesas del Presidente */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                ¿A qué mesas asistirá personalmente el Presidente?
              </label>
              {foundGuest.mesas_preasignadas.length > 0 && (
                <p className="text-emerald-400 text-xs font-semibold mb-2">ℹ️ Se han pre-seleccionado las mesas asignadas del participante. Puedes marcar mesas adicionales si es necesario:</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#1a2640] p-4 rounded-xl border border-[#1e2d4a] max-h-48 overflow-y-auto">
                {mesas.map(m => {
                  const isChecked = selectedMesaIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-3 text-xs text-gray-300 hover:text-white cursor-pointer py-1 px-2 rounded hover:bg-[#111a2e] transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedMesaIds(selectedMesaIds.filter(id => id !== m.id));
                          } else {
                            setSelectedMesaIds([...selectedMesaIds, m.id]);
                          }
                        }}
                        className="rounded border-[#1e2d4a] bg-[#111a2e] text-[#60c0ea] focus:ring-0 focus:ring-offset-0"
                      />
                      <span>{m.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Toggle Acompañantes */}
            <div className="flex items-center justify-between p-4 bg-[#1a2640]/55 rounded-xl border border-[#1e2d4a]">
              <div>
                <span className="text-sm font-bold text-white block">¿Viene con acompañantes?</span>
                <span className="text-xs text-gray-400 block">Permite designar acompañantes a las mesas de trabajo libres del presidente.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHasCompanions(!hasCompanions);
                  if (!hasCompanions) setCompanions([]);
                }}
                className={`px-4 py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all border ${
                  hasCompanions 
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40' 
                    : 'bg-[#111a2e] text-gray-400 border-gray-700'
                }`}
              >
                {hasCompanions ? 'Sí' : 'No'}
              </button>
            </div>

            {/* Formulario Dinámico de Acompañantes */}
            {hasCompanions && (
              <div className="space-y-4 border-t border-[#1e2d4a] pt-4 animate-slide-up">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Acompañantes Designados</h3>
                  <button
                    type="button"
                    onClick={handleAddCompanion}
                    className="px-3 py-1.5 text-xs bg-[#004e74] hover:bg-[#004e74]/80 text-white font-bold rounded-lg transition-all"
                  >
                    + Agregar Acompañante
                  </button>
                </div>

                {companions.length === 0 ? (
                  <p className="text-gray-500 text-xs py-4 text-center">No has agregado acompañantes aún. Presiona el botón para agregar uno.</p>
                ) : (
                  <div className="space-y-4">
                    {companions.map((comp, idx) => {
                      const availableMesas = getAvailableMesasForCompanion(idx);
                      return (
                        <div key={idx} className="p-4 bg-[#0b111e] border border-[#1e2d4a] rounded-xl relative space-y-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveCompanion(idx)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-400 text-xs"
                            title="Eliminar acompañante"
                          >
                            Eliminar
                          </button>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre Completo *</label>
                              <input
                                type="text"
                                required
                                value={comp.nombre}
                                onChange={e => handleCompanionChange(idx, 'nombre', e.target.value)}
                                className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#60c0ea]"
                                placeholder="Nombre completo"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cédula *</label>
                              <input
                                type="text"
                                required
                                value={comp.cedula}
                                onChange={e => handleCompanionChange(idx, 'cedula', e.target.value)}
                                className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#60c0ea]"
                                placeholder="Ej. V12345678"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Teléfono *</label>
                              <input
                                type="text"
                                required
                                value={comp.telefono}
                                onChange={e => handleCompanionChange(idx, 'telefono', e.target.value)}
                                className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#60c0ea]"
                                placeholder="Ej. 04141234567"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mesa de Trabajo *</label>
                              <select
                                required
                                value={comp.mesa_id}
                                onChange={e => handleCompanionChange(idx, 'mesa_id', e.target.value)}
                                className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#60c0ea]"
                              >
                                <option value="" disabled>Seleccione mesa...</option>
                                {availableMesas.map(m => (
                                  <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                              </select>
                              {foundGuest.mesas_preasignadas.length > 0 && 
                               availableMesas.some(m => !foundGuest.mesas_preasignadas.some(pm => pm.id === m.id)) && (
                                <p className="text-[10px] text-amber-400 mt-1">⚠️ Sin mesas preasignadas libres. Mostrando mesas de la lista general.</p>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 bg-[#1a2640] p-2 rounded-lg border border-[#1e2d4a]">
                              <label className="flex items-center gap-2 text-[10px] font-bold text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={comp.es_directivo}
                                  onChange={e => handleCompanionChange(idx, 'es_directivo', e.target.checked)}
                                  className="rounded border-[#1e2d4a] bg-[#111a2e] text-[#60c0ea] focus:ring-0 focus:ring-offset-0"
                                />
                                <span>¿Es Directivo del Condominio?</span>
                              </label>

                              {comp.es_directivo && (
                                <input
                                  type="text"
                                  required
                                  value={comp.cargo_directivo}
                                  onChange={e => handleCompanionChange(idx, 'cargo_directivo', e.target.value)}
                                  placeholder="Escriba su cargo (Ej. Vocero, Secretario)"
                                  className="w-full bg-[#111a2e] border border-[#1e2d4a] text-white rounded-md px-2 py-1 text-[10px] focus:outline-none focus:border-[#60c0ea]"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-200 rounded-xl flex items-start gap-2.5 text-xs">
                <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowMesaSelection(false);
                  setFoundGuest(null);
                  setCedula('');
                }}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRegistration}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-1.5"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Registrando...' : 'Confirmar Registro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 3: Confirmación de Registro Exitoso */}
      {registrado && asistenteInfo && (
        <div 
          ref={cardRef}
          className="bg-[#111a2e] border border-emerald-500/30 rounded-2xl p-8 shadow-2xl space-y-6 text-center"
        >
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest block">Asistencia Confirmada</span>
            <h2 className="text-2xl font-bold text-white">{asistenteInfo.nombre}</h2>
            <p className="text-gray-400 text-sm">{asistenteInfo.condominio} | C.I. {asistenteInfo.cedula}</p>
          </div>

          <div className="p-6 bg-[#0b111e] border border-[#1e2d4a] rounded-xl flex flex-col items-center gap-2">
            <MapPin className="h-6 w-6 text-[#60c0ea]" />
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Mesas de Trabajo Registradas</span>
            <span className="text-sm text-gray-200 font-bold max-w-md">{mesaAsignadaText}</span>
          </div>

          {/* Estado de notificación de Whatsapp */}
          <div className="border-t border-[#1e2d4a] pt-6 flex items-center justify-center gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
              waStatus?.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#1a2640] text-gray-400'
            }`}>
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="text-left">
              <span className="text-xs text-gray-400 block font-semibold">Notificación de WhatsApp</span>
              <span className="text-sm text-gray-200">{waStatus?.msg || 'Procesando envío...'}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setRegistrado(false);
              setCedula('');
              setAsistenteInfo(null);
              setMesaAsignadaText('');
              setWaStatus(null);
            }}
            className="w-full py-3 bg-[#1a2640] hover:bg-[#1a2640]/80 text-white font-bold rounded-xl transition-all"
          >
            Registrar Siguiente Participante
          </button>
        </div>
      )}
    </div>
  );
}
