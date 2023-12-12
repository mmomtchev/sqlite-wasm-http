const path = require('path');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const PreloadWebpackPlugin = require('@vue/preload-webpack-plugin');
const StatoscopeWebpackPlugin = require('@statoscope/webpack-plugin').default;
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env, argv) => {
  let profiler = [];
  switch (env.profiler) {
    case 'statoscope':
      profiler = [new StatoscopeWebpackPlugin()];
      break;
    case 'treemap':
      profiler = [new BundleAnalyzerPlugin()];
      break;
  }

  return {
    entry: './examples/index.ts',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        }
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      plugins: [
        new TsconfigPathsPlugin({ configFile: './examples/tsconfig.json' }),
      ],
    },
    output: {
      filename: '[name].bundle.js',
      path: path.resolve(__dirname, 'docs', 'examples'),
      clean: true
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: 'examples/index.html'
      }),
      new PreloadWebpackPlugin(),
      new webpack.DefinePlugin({
        SQLITE_DEBUG: JSON.stringify(process.env.SQLITE_DEBUG?.split(',') ?? [])
      }),
      ...profiler
    ],
    optimization: {
      splitChunks: {
        chunks: 'all'
      },
    },
    stats: 'detailed',
    devtool: argv.mode === 'production' ? 'source-map' : 'inline-source-map',
    devServer: {
      static: {
        directory: path.join(__dirname, 'examples'),
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      },
      compress: true,
      port: 9000,
    }
  };
};
