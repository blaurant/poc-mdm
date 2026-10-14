import http from 'node:http';
import { ErreurDomaine } from '../../domain/index.js';

/**
 * HTTP gateway. Its only job is to translate an HTTP request into a scenario call
 * and the scenario result into an HTTP response. It holds no business logic.
 *
 *   POST /integrer-donnees    body: raw source extraction   -> integrerDonnees(extraction)
 *   GET  /extraire-donnees?identifiantPatient=&aLaDate=      -> extraireDonnees({ identifiantPatient, aLaDate })
 *   POST /regles-qualite      body: rule definition         -> definirRegleQualite(definition)
 *   GET  /health
 *
 * @param {{ integrerDonnees: Function, extraireDonnees: Function, definirRegleQualite: Function }} scenarios
 *   scenarios already bound to their dependencies by the composition root
 * @returns {http.Server}
 */
export function createHttpGateway(scenarios) {
  const routes = {
    'POST /integrer-donnees': async (request) => [201, await scenarios.integrerDonnees(await readJson(request))],
    'GET /extraire-donnees': async (_request, url) => {
      const requete = { identifiantPatient: url.searchParams.get('identifiantPatient') ?? undefined };
      if (url.searchParams.has('aLaDate')) requete.aLaDate = url.searchParams.get('aLaDate');
      return [200, await scenarios.extraireDonnees(requete)];
    },
    'POST /regles-qualite': async (request) => [201, await scenarios.definirRegleQualite(await readJson(request))],
    'GET /health': async () => [200, { status: 'ok' }],
  };

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const route = routes[`${request.method} ${url.pathname}`];
    try {
      if (!route) return send(response, 404, { error: 'NOT_FOUND', message: `${request.method} ${url.pathname}` });
      const [status, body] = await route(request, url);
      send(response, status, body);
    } catch (error) {
      if (error instanceof ErreurDomaine) {
        send(response, error.code === 'PATIENT_INCONNU' ? 404 : 400, { error: error.code, message: error.message });
      } else if (error instanceof SyntaxError) {
        send(response, 400, { error: 'INVALID_JSON', message: error.message });
      } else {
        send(response, 500, { error: 'INTERNAL_ERROR', message: error.message });
      }
    }
  });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}
