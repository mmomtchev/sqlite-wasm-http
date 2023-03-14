const path = require('path');
const fs = require('fs');

const dir = path.resolve(__dirname, 'browser-react-js', 'build', 'static', 'js');
const js = fs.readdirSync(dir).find((x) => x.match(/main\.[a-f0-9]+.js/));
if (!js)
  throw new Error(`Missing main.js bundle`);

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha'],
    client: {
      mocha: {
        reporter: 'html',
        timeout: 25000
      }
    },
    files: [
      { pattern: path.join('browser-react-js', 'build', 'static', 'js', js), included: true },
      { pattern: '../../scripts/wait-test.js', included: true },
      { pattern: 'browser-react-js/build/*', served: true, included: false },
      { pattern: 'browser-react-js/build/static/js/*', served: true, included: false },
      { pattern: 'browser-react-js/build/static/media/*', served: true, included: false }
    ],
    exclude: [
    ],
    preprocessors: {
    },
    proxies: {
      '/static/js/': path.join(__dirname, 'browser-react-js', 'build', 'static', 'js'),
      '/static/media/': path.join(__dirname, 'browser-react-js', 'build', 'static', 'media')
    },
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['Chrome'],
    singleRun: true,
    concurrency: Infinity
  });
};
