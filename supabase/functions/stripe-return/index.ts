const APP_RETURN_URL = 'tech.domnex.girocerto://billing-result';

Deno.serve((request) => {
  const status = new URL(request.url).searchParams.get('status') === 'success' ? 'success' : 'cancel';
  const target = `${APP_RETURN_URL}?status=${status}`;
  const title = status === 'success' ? 'Pagamento concluído' : 'Pagamento cancelado';
  const message =
    status === 'success'
      ? 'Sua assinatura está sendo confirmada. Volte ao Giro Certo para continuar.'
      : 'Nenhuma cobrança foi concluída.';

  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#090d16;color:#e2e8f0;font-family:system-ui;display:grid;min-height:100vh;place-items:center}.card{max-width:360px;margin:24px;padding:28px;border:1px solid #334155;border-radius:24px;background:#0f172a;text-align:center}a{display:block;margin-top:20px;padding:12px;border-radius:12px;background:#10b981;color:#052e2b;font-weight:800;text-decoration:none}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p><a href="${target}">Voltar ao Giro Certo</a></main><script>location.href=${JSON.stringify(target)}</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
});
