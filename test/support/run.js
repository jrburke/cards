/* global assert:true */
'use strict';

var [url, urlArgs] = location.href.split('?');
url = url.replace(/\/test\.html/, '');

var testId = url.split('/').pop();

document.querySelector('title').textContent = 'Test: ' + testId;

require.config({
  baseUrl: url,
  paths: {
    mocha: '../../node_modules/mocha/mocha',
    chai: '../support/chai',
    cards: '../../cards',
    evt: '../../lib/evt',
    transition_end: '../../lib/transition_end'
  }
});

if (urlArgs) {
  require.config({
    urlArgs: urlArgs
  });
}

var assert;
require(['chai', 'mocha'], function(chai) {
  mocha.setup('bdd');
  assert = chai.assert;
  require(['test'], function(test) {
    mocha.run(function(failures) {
      window.parent.postMessage({
        id: testId,
        failures: failures
      }, '*');
    });
  });
});
