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
      co(function* () {
        yield cards.add('immediate', 'first-card');
        yield cards.add('animate', 'second-card');
        yield cards.add('animate', 'third-card');

        var secondCard = qs('second-card');
        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, secondCard.classList.contains('before'));
        assert.equal(true, qs('third-card').classList.contains('center'));

        cards.remove(secondCard);

        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, !qs('second-card'));
        assert.equal(2, cards._cardStack.length);
        assert.equal(true, qs('third-card').classList.contains('center'));

        yield cards.back('animate');

        assert.equal(true, qs('first-card').classList.contains('center'));
        assert.equal(true, !qs('third-card'));
        assert.equal(1, cards._cardStack.length);
      })
      .then(done)
      .catch(done);
    });
  });

});
