'use strict';
define('first-card', function(require) {
  return {
    createdCallback: function() {
      this.innerHTML = '<h1>Card 1</h1>';
    }
  };
});

define('second-card', function(require) {
  return {
    createdCallback: function() {
      this.innerHTML = '<h1>Card 2</h1>';
    }
  };});

define('cards_init', function(require) {
  return function(cards) {

    cards.elementToType = function(element) {
      return element.nodeName.toLowerCase();
    };

    cards.typeToModuleId = function(type) {
      return 'element!' + type;
    };

    cards.pushDefaultCard = function() {
      return cards.pushCard('first-card', 'none', {}, 'leftHistory');
    };

  };
});


define(function(require) {
  var cards = require('cards');

  function qs(query) {
    return document.querySelector(query);
  }

  cards.init();

  describe('default card', function() {
    it('add second-card, go back to first-card', function(done) {
      cards.pushCard('second-card', 'immediate').then(function(element) {
        return cards.back('animate');
      }).then(function() {
          assert.equal(true, qs('first-card').classList.contains('center'));
          assert.equal(true, !qs('second-card'));
          done();
      }).catch(function(err) {
        done(err);
      });
    });
  });

});
