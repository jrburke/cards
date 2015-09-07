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
      this.classList.add('anim-overlay', 'anim-vertical');
      this.innerHTML = '<h1>Card 2</h1>';
    }
  };});
define('third-card', function(require) {
  return {
    createdCallback: function() {
      this.innerHTML = '<h1>Card 3</h1>';
    }
  };});


define(function(require) {
  var cards = require('cards');

  function qs(query) {
    return document.querySelector(query);
  }

  cards.init();

  describe('remove middle card', function() {
    it('Add three cards, remove second one', function(done) {
      this.timeout(8000);

      cards.pushCard('immediate', 'first-card').then(function(element) {
        //z-index
        return cards.pushCard('animate', 'second-card');
      }).then(function() {
        return cards.pushCard('animate', 'third-card');
      }).then(function() {
        //z-index
        return cards.pushCard('animate', 'second-card');
      }).then(function() {
        return cards.pushCard('animate', 'first-card');
      }).then(function() {
        return cards.pushCard('animate', 'third-card');
      }).then(function() {
        //z-index
        return cards.pushCard('animate', 'second-card');
      }).then(function() {
        return cards.pushCard('animate', 'third-card');
      }).then(function() {
        return cards.pushCard('animate', 'third-card');
      }).then(function() {
        return cards.pushCard('animate', 'first-card');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        //z-index
        return cards.pushCard('animate', 'second-card');
      }).then(function() {
        return cards.pushCard('animate', 'third-card');
      }).then(function() {
        return cards.pushCard('animate', 'first-card');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        //z-index
        return cards.pushCard('animate', 'second-card');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        return cards.back('animate');
      }).then(function() {
        assert.equal(1, document.querySelectorAll('.card').length);
        assert.equal(true, !!qs('first-card'));
        assert.equal(0, cards._zIndex);
        done();
      }).catch(function(err) {
        done(err);
      });
    });
  });

});
