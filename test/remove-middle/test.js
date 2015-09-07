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
      cards.pushCard('immediate', 'first-card').then(function(element) {
        return cards.pushCard('animate', 'second-card');
      }).then(function() {
        return cards.pushCard('animate', 'third-card');
      }).then(function() {
        var secondCard = qs('second-card');
        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, secondCard.classList.contains('before'));
        assert.equal(true, qs('third-card').classList.contains('center'));

        cards.removeCard(secondCard);

        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, !qs('second-card'));
        assert.equal(2, cards._cardStack.length);
        assert.equal(true, qs('third-card').classList.contains('center'));

        return cards.back('animate')
        .then(function() {
          assert.equal(true, qs('first-card').classList.contains('center'));
          assert.equal(true, !qs('third-card'));
          assert.equal(1, cards._cardStack.length);
          done();
        });
      }).catch(function(err) {
        done(err);
      });
    });
  });

});
