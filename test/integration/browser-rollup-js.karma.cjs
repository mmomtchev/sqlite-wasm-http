// Karma configuration
// Generated on Mon Mar 13 2023 20:12:27 GMT+0100 (Central European Standard Time)

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
      { pattern: 'browser-rollup-js/temp/index.js', included: true },
      { pattern: '../../scripts/rollup-test.js', included: true },
      { pattern: 'browser-rollup-js/temp/*', served: true, included: false },
      { pattern: 'browser-rollup-js/temp/assets/*', served: true, included: false }
    ],
    exclude: [
    ],
    preprocessors: {
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
