/* global assert:true */
'use strict';

var [url, urlArgs] = location.href.split('?');
url = url.replace(/\/test\.html/, '');

var testId = url.split('/').pop();

document.querySelector('title').textContent = 'Test: ' + testId;

require.config({
  baseUrl: url,
  paths: {
    cards: '../../cards',
    cards_init: '../support/cards_init',
    chai: '../support/chai',
    element: '../support/element',
    evt: '../../lib/evt',
    mocha: '../../node_modules/mocha/mocha',
    transition_end: '../../lib/transition_end'
  },
  config: {
    element: {
      idToTag: function(id) {
        return id.toLowerCase().replace(/\//g, '-');
      }
    }
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
