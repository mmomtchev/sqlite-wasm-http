// Karma configuration
// Generated on Mon Mar 13 2023 20:12:27 GMT+0100 (Central European Standard Time)

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha'],
    client: {
      mocha: {
        reporter: 'html',
        timeout: 5000
      }
    },
    files: [
      { pattern: 'browser-webpack-js/temp/bundle.js', included: true },
      { pattern: 'browser-webpack-js/temp/*', served: true, included: false }
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
