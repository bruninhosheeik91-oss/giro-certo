import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

/** Dados públicos de um alerta para a página de acompanhamento (acesso só com o token do link). */
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response(JSON.stringify({ error: 'Link inválido.' }), { status: 400, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
  const { data: alert } = await admin
    .from('panic_alerts')
    .select('id, driver_name, started_at, ended_at, last_lat, last_lng, last_accuracy, last_at')
    .eq('share_token', token)
    .maybeSingle();
  if (!alert) return new Response(JSON.stringify({ error: 'Alerta não encontrado.' }), { status: 404, headers });

  // Depois de encerrado há mais de 24h, o link deixa de mostrar a posição.
  const expired = alert.ended_at && Date.now() - Date.parse(alert.ended_at) > 24 * 60 * 60 * 1000;
  const { data: trail } = expired
    ? { data: [] }
    : await admin
        .from('panic_locations')
        .select('lat, lng, recorded_at')
        .eq('alert_id', alert.id)
        .order('recorded_at', { ascending: true })
        .limit(500);

  let photos: { url: string; at: string }[] = [];
  if (!expired) {
    const { data: rows } = await admin
      .from('panic_photos')
      .select('path, taken_at')
      .eq('alert_id', alert.id)
      .order('taken_at', { ascending: false })
      .limit(5);
    if (rows?.length) {
      const { data: signed } = await admin.storage.from('panic-photos').createSignedUrls(rows.map((r) => r.path), 3600);
      photos = rows
        .map((r, i) => ({ url: signed?.[i]?.signedUrl ?? '', at: r.taken_at }))
        .filter((p) => p.url);
    }
  }

  return new Response(
    JSON.stringify({
      photos,
      driverName: alert.driver_name,
      startedAt: alert.started_at,
      endedAt: alert.ended_at,
      expired: Boolean(expired),
      last: expired || alert.last_lat == null ? null : { lat: alert.last_lat, lng: alert.last_lng, accuracy: alert.last_accuracy, at: alert.last_at },
      trail: trail ?? [],
    }),
    { headers },
  );
});
