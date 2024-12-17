const path = require('path');
const url = require('url');
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
        timeout: 40000
      }
    },
    files: [
      { pattern: path.join(__dirname, 'browser-react-js', 'build', 'static', 'js', js), included: true },
      { pattern: path.resolve(__dirname, '..', '..', 'scripts', 'wait-test.js'), included: true },
      { pattern: path.join(__dirname, 'browser-react-js', 'build', '*'), served: true, included: false },
      { pattern: path.join(__dirname, 'browser-react-js', 'build', 'static', 'js', '*'), served: true, included: false },
      { pattern: path.join(__dirname, 'browser-react-js', 'build', 'static', 'media', '*'), served: true, included: false }
    ],
    exclude: [
    ],
    preprocessors: {
    },
    proxies: {
      '/static/': 'http://localhost:9876/base/browser-react-js/build/static/',
    },
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['ChromeHeadless'],
    singleRun: true,
    concurrency: Infinity
  });
};
