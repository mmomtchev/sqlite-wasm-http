// This is part of the unit testing

// It is required for the rollup and the React bundles
// because they use asynchronous initialization
// while mocha does not support asynchronous registering of new tests

it('wait for async loading', (done) => {
  window.testDone = done;
});
