// Vercel entrypoint (see vercel.json). It loads the `nest build` output, which
// tsc compiles with the decorator metadata Nest's dependency injection needs,
// and exports the initialised Express app. Docker and local runs use
// `node dist/main.js` instead.
import { createVercelHandler } from './dist/vercel.js';

export default await createVercelHandler();
