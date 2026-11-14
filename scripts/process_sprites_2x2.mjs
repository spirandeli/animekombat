import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pyScript = resolve(__dirname, 'process_sprites_2x2.py');

try {
  execFileSync('python3', [pyScript], { stdio: 'inherit' });
} catch (error) {
  console.error('Falha ao executar pipeline de sprites 2x2:', error);
  process.exit(1);
}
