// Entry point of the POC MDM application: starts the HTTP gateway on an in-memory document store.
import { createApplication } from './application.js';
import { SystemClock } from './infrastructure/clock/system-clock.js';

const port = Number(process.env.PORT ?? 3000);
const { gateway } = await createApplication({ clock: new SystemClock() });

gateway.listen(port, () => {
  console.log(`poc-mdm gateway listening on http://localhost:${port}`);
  console.log('  POST /integrer-donnees   GET /extraire-donnees?identifiantPatient=...&aLaDate=...   POST /regles-qualite');
});
