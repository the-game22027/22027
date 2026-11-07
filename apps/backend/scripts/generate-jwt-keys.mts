/**
 * Writes a fresh ES256 signing key pair into the local .env (04-auth.md §11).
 * Usage: npm run keys:generate [-- --force]
 * Development only: production keys come from the host's secret store, never from this script.
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_FILE = '.env';
const force = process.argv.includes('--force');

if (!existsSync(ENV_FILE)) {
  copyFileSync('.env.example', ENV_FILE);
  console.log('Created .env from .env.example');
}

let env = readFileSync(ENV_FILE, 'utf8');
const currentKey = /^JWT_PRIVATE_KEY=(.+)$/m.exec(env)?.[1]?.trim();
if (currentKey && currentKey !== '""' && !force) {
  console.log('JWT_PRIVATE_KEY is already set. Run with --force to replace it (signs everyone out locally).');
  process.exit(0);
}

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();
const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const keyId = `dev-${date}-${randomBytes(2).toString('hex')}`;

function setVar(name: string, value: string): void {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, () => line) : `${env.trimEnd()}\n${line}\n`;
}

// One line with literal \n: the config loader turns them back into line breaks.
setVar('JWT_PRIVATE_KEY', `"${pem.replaceAll('\n', '\\n')}"`);
setVar('JWT_KEY_ID', keyId);
writeFileSync(ENV_FILE, env);
console.log(`Wrote a new ES256 key to .env (JWT_KEY_ID=${keyId})`);
