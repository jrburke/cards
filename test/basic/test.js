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
      cards.pushCard('immediate', 'first-card').then(function(element) {
        return cards.pushCard('animate', 'second-card');
      }).then(function() {
          assert.equal(true, qs('first-card').classList.contains('before'));
          assert.equal(true, qs('second-card').classList.contains('center'));
          done();
      }).catch(function(err) {
        done(err);
      });
    });
  });

});
