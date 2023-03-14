// This is part of the unit testing

// It is required because the rollup bundle is an AMD bundle
// and requires the document ready event to work
// while mocha does not support asynchronous registering of new tests

it('wait for async loading', (done) => {
  window.rollupDone = done;
});
