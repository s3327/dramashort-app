/**
 * Test-only preload: makes `import "server-only"` a no-op in the unit tests.
 *
 * `server-only` is a marker package that throws the moment it is imported.
 * Next.js swaps it out when it builds the app, so server modules such as
 * lib/server/*.ts can start with `import "server-only"` and still run on the
 * server. The unit tests load those same modules in plain Node.js (through
 * tsx), where nothing swaps it out, so the real package would abort every test
 * file that touches a server module.
 *
 * The `test` script in package.json loads this file with `--require`. It marks
 * the package's entry point as already loaded, with empty exports, for the test
 * process only. Nothing inside node_modules is changed, so the suite behaves
 * the same on a fresh `npm ci` (CI) as on a developer machine.
 */
"use strict";

const Module = require("node:module");

const entry = require.resolve("server-only");
const stub = new Module(entry);
stub.filename = entry;
stub.loaded = true;
stub.exports = {};
require.cache[entry] = stub;
