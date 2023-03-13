import { nodeResolve } from '@rollup/plugin-node-resolve';
import OMT from "@surma/rollup-plugin-off-main-thread";
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';

export default {
  input: 'index.js',
  output: {
    dir: 'temp',
    format: 'amd'
  },
  plugins: [nodeResolve({ browser: true }), OMT(), importMetaAssets()]
};
