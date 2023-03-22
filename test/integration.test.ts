import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';
import * as url from 'url';
import { execSync } from 'child_process';

describe('integration tests', () => {
  const dirname = url.fileURLToPath(new URL(import.meta.url).href);
  const testDir = path.resolve(dirname, '..', 'integration');
  const list = fs.readdirSync(testDir);

  const install = process.env.SQLITE_INSTALL_CMD ?? 'npm link sqlite-wasm-http';
  const root = process.cwd();

  for (const test of list) {
    if (!(fs.statSync(path.resolve(testDir, test))).isDirectory())
      continue;

    const karmaPath = path.resolve(testDir, test + '.karma.cjs');
    let karma = false;
    try {
      fs.statSync(karmaPath);
      karma = true;
    } catch { /* empty */ }

    it(test + (karma ? ' (karma)' : ' (node)'), async () => {
      try {
        process.chdir(path.resolve(testDir, test));
        execSync('npm install');
        execSync(install);
        if (karma) {
          execSync('npm run build', {stdio: 'pipe'});
          process.chdir(root);
          execSync(`karma start ${karmaPath}`);
        } else {
          execSync('npm test');
        }
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.error((e as any).stdout.toString());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.error((e as any).stderr.toString());
        throw new Error('Test failed');
      }
    });
  }
});
