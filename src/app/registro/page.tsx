'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { evolutionService } from '@/lib/evolution-api';
import { 
  Search, CheckCircle2, UserCheck, MessageSquare, 
  MapPin, AlertCircle, Loader2 
} from 'lucide-react';
import { animate } from 'animejs';

interface MesaInfo {
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
  mesa_preasignada_id: string | null;
  asistio: boolean;
}

interface DbMesaResponse {
  id: string;
  numero: number;
  nombre: string;
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
  const [selectedMesaId, setSelectedMesaId] = useState<string>('');
  
  // Registration result states
  const [registrado, setRegistrado] = useState(false);
  const [asistenteInfo, setAsistenteInfo] = useState<AsistenteInfo | null>(null);
  const [mesaAsignada, setMesaAsignada] = useState<MesaInfo | null>(null);
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

  // Search by Cédula
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedula.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setRegistrado(false);
    setFoundGuest(null);
    setShowMesaSelection(false);
    setMesaAsignada(null);
    setWaStatus(null);

    try {
      const { data: guests, error: searchError } = await supabase
        .from('asistentes')
        .select('*')
        .eq('cedula', cedula.trim());

      if (searchError) throw searchError;

      if (!guests || guests.length === 0) {
        setErrorMsg('Esta cédula no se encuentra registrada en la lista oficial de invitados.');
        setLoading(false);
        return;
      }

      const guest = guests[0] as AsistenteInfo;
      setFoundGuest(guest);
      setSelectedMesaId(guest.mesa_preasignada_id || '');
      setShowMesaSelection(true);
    } catch (error) {
      console.error(error);
      setErrorMsg('Error al buscar el participante.');
    } finally {
      setLoading(false);
    }
  };

  // Confirm registration and selected mesa
  const handleConfirmRegistration = async () => {
    if (!foundGuest || !selectedMesaId) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const chosenMesa = mesas.find(m => m.id === selectedMesaId);
      if (!chosenMesa) throw new Error('Mesa seleccionada no válida');

      // Update db
      const { error: updateError } = await supabase
        .from('asistentes')
        .update({
          mesa_preasignada_id: selectedMesaId,
          asistio: true,
          fecha_registro: new Date().toISOString(),
        })
        .eq('id', foundGuest.id);

      if (updateError) throw updateError;

      const updatedGuest = {
        ...foundGuest,
        mesa_preasignada_id: selectedMesaId,
        asistio: true
      };

      setAsistenteInfo(updatedGuest);
      setMesaAsignada({
        numero: chosenMesa.numero,
        nombre: chosenMesa.nombre
      });
      setShowMesaSelection(false);
      setRegistrado(true);

      // Send WhatsApp
      if (updatedGuest.telefono) {
        const customMessage = `¡Hola, ${updatedGuest.nombre}! Le damos una cordial bienvenida al Primer Encuentro de Condominios. 
 
Ha sido asignado a la: 
📌 *Mesa ${chosenMesa.numero}: ${chosenMesa.nombre}*
 
Su participación es fundamental para el desarrollo y bienestar de su comunidad (${updatedGuest.condominio}). ¡Nos vemos adentro!`;

        setWaStatus({ success: false, msg: 'Enviando mensaje de confirmación...' });
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
        setWaStatus({ success: false, msg: 'No se pudo enviar WhatsApp: Teléfono no disponible.' });
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
    <div className="max-w-2xl mx-auto space-y-8 py-6">
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
            <div className="p-4 bg-red-950/20 border border-red-900/50 text-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-bold block">Participante no encontrado</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Paso 2: Selección y Confirmación de Mesa */}
      {showMesaSelection && foundGuest && (
        <div className="bg-[#111a2e] border border-[#1e2d4a] rounded-2xl p-6 shadow-xl space-y-6 animate-slide-up">
          <div className="border-b border-[#1e2d4a] pb-4">
            <span className="text-xs font-semibold text-[#60c0ea] uppercase tracking-wider block">Verificar Participante</span>
            <h2 className="text-xl font-bold text-white mt-1">{foundGuest.nombre}</h2>
            <p className="text-gray-400 text-sm mt-0.5">{foundGuest.condominio} | C.I. {foundGuest.cedula}</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Asignación de Mesa de Trabajo
              </label>
              <select
                value={selectedMesaId}
                onChange={e => setSelectedMesaId(e.target.value)}
                className="w-full bg-[#1a2640] border border-[#1e2d4a] text-white rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#60c0ea] focus:ring-1 focus:ring-[#60c0ea] transition-all text-sm"
              >
                <option value="" disabled>Seleccione una mesa...</option>
                {mesas.map(m => (
                  <option key={m.id} value={m.id}>
                    Mesa {m.numero}: {m.nombre}
                  </option>
                ))}
              </select>
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
                disabled={loading || !selectedMesaId}
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
      {registrado && asistenteInfo && mesaAsignada && (
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
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Mesa de Trabajo</span>
            <span className="text-2xl font-black text-white">Mesa {mesaAsignada.numero}</span>
            <span className="text-sm text-gray-300 font-medium">{mesaAsignada.nombre}</span>
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
              setMesaAsignada(null);
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
