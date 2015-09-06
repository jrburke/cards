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
      cards.pushCard('first-card', 'immediate').then(function(element) {
        return cards.pushCard('second-card', 'animate');
      }).then(function() {
        return cards.pushCard('third-card', 'animate');
      }).then(function() {
        var secondCard = qs('second-card');
        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, secondCard.classList.contains('before'));
        assert.equal(true, qs('third-card').classList.contains('center'));

        cards.removeHiddenCard(secondCard);

        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, !qs('second-card'));
        assert.equal(2, cards._cardStack.length);
        assert.equal(true, qs('third-card').classList.contains('center'));

        cards.once('cardVisible', function() {
          assert.equal(true, qs('first-card').classList.contains('center'));
//todo: re-enable once removeCardAndSuccessors returns promise and the dead
//node clean happens as part of that.
//          assert.equal(true, !qs('third-card'));
          assert.equal(1, cards._cardStack.length);
          done();
        });

        cards.removeCardAndSuccessors(qs('third-card'), 'animate');
      }).catch(function(err) {
        done(err);
      });
    });
  });

});
