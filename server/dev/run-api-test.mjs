// Starts the fake-DB server, runs the API checks against it, then stops it. Run: npm run test:api
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const server = spawn(process.execPath, ['--import', 'tsx', path.join(dir, 'fake-db-server.cts')], { cwd: path.join(dir, '..'), env: { ...process.env, PORT: '4000' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { server.stdout.on('data', (d) => String(d).includes('HARNESS_READY') && res()); server.on('exit', () => rej(new Error('server exited'))); setTimeout(() => rej(new Error('server start timeout')), 30000); });
const test = spawn('node', [path.join(dir, 'api-test.mjs')], { stdio: 'inherit' });
test.on('exit', (code) => { server.kill(); process.exit(code ?? 1); });
