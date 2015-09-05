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

define(function(require) {
  var cards = require('cards');

  function qs(query) {
    return document.querySelector(query);
  }

  cards.init();

  describe('add two cards', function() {
    it('has two cards', function(done) {
      cards.pushCard('first-card', 'immediate').then(function(element) {
        return cards.pushCard('second-card', 'animate');
      }).then(function() {
          assert.equal(true, qs('first-card').classList.contains('before'));
          assert.equal(true, qs('second-card').classList.contains('center'));
          done();
      });
    });
  });

});
