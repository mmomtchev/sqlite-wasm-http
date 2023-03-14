import * as path from 'path';
import { promises as fs } from 'fs';
import * as process from 'process';
import { exec as execAsync } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execAsync);

const dirname = new URL(import.meta.url).pathname;
const testDir = path.resolve(dirname, '..', '..', 'test', 'integration');
(async function () {
  const list = await fs.readdir(testDir);

  for (const test of list) {
    if (!(await fs.stat(path.resolve(testDir, test))).isDirectory())
      continue;

    console.log('Running', test);
    process.chdir(path.resolve(testDir, test));
    try {
      await exec('npm install');
      await exec(process.argv.slice(2).join(' '));
      await exec('npm test');
    } catch (e) {
      console.error(e.stdout);
      console.error(e.stderr);
      throw new Error('Test failed');
    }
  }
})();
