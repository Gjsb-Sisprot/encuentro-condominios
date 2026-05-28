import type { SupabaseClient } from "@supabase/supabase-js";

import { cleanCedula } from "./utils";

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getCedulaDigits(cedula: string): string {
  return cedula.replace(/\D/g, "");
}

export function getCedulaSearchVariants(cedula: string): string[] {
  const cleaned = cleanCedula(cedula);
  const digits = getCedulaDigits(cedula);
  const prefixMatch = cleaned.match(/^([VEJG])-?(.+)$/);
  const prefix = prefixMatch?.[1] || "V";
  const prefixedDigits = digits ? `${prefix}${digits}` : "";
  const dashedPrefixedDigits = digits ? `${prefix}-${digits}` : "";

  return uniqueValues([
    cedula.trim(),
    cleaned,
    digits,
    prefixedDigits,
    dashedPrefixedDigits,
  ]);
}

export async function findAsistenteByCedula<T>(
  supabase: SupabaseClient,
  cedula: string,
  select: string,
  jornada?: string
): Promise<{ data: T | null; error: Error | null }> {
  const variants = getCedulaSearchVariants(cedula);

  let query = supabase
    .from("asistentes")
    .select(select)
    .in("cedula", variants);

  if (jornada) {
    if (jornada === 'Jornada General') {
      query = query.or('estado.is.null,estado.not.ilike.%|%,estado.ilike.%|Jornada General');
    } else {
      query = query.ilike('estado', `%|${jornada}`);
    }
  }

  const { data, error } = await query.limit(1);

  if (error) {
    return { data: null, error };
  }

  return { data: (data?.[0] as T | undefined) ?? null, error: null };
}
