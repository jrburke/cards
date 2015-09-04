'use strict';
define('first-card', function(require) {
  return {};
});
define('second-card', function(require) {
  return {};
});

define(function(require) {
  var cards = require('cards');
  var cardCount = 0;

  function qs(query) {
    return document.querySelector(query);
  }

  cards.init();

  describe('add two cards', function() {
    it('has two cards', function(done) {

      function onVisible(element) {
        cardCount += 1;
        if (cardCount === 1) {
          cards.pushCard('second-card', 'animate');
        } else if (cardCount === 2) {
          done();

          assert.equal(true, qs('first-card').classList.contains('before'));
          assert.equal(true, qs('second-card').classList.contains('center'));
          cards.removeListener(onVisible);
        }
      }

      cards.on('cardVisible', onVisible);

      cards.pushCard('first-card', 'immediate');

    });
  });

});
