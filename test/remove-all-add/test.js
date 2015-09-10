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

  describe('removeAll', function() {
    it('Add three cards, remove all, add two', function(done) {
      co(function* () {
        yield cards.add('immediate', 'first-card');
        yield cards.add('animate', 'second-card');
        yield cards.add('animate', 'third-card');

        var secondCard = qs('second-card');
        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, secondCard.classList.contains('before'));
        assert.equal(true, qs('third-card').classList.contains('center'));

        cards.removeAll();

        assert.equal(-1, cards.activeCardIndex);
        assert.equal(true, !qs('.card'));

        yield cards.add('immediate', 'first-card');
        yield cards.add('animate', 'second-card');
        yield cards.add('animate', 'third-card');

        assert.equal(true, qs('first-card').classList.contains('before'));
        assert.equal(true, qs('second-card').classList.contains('before'));
        assert.equal(true, qs('third-card').classList.contains('center'));
      })
      .then(done)
      .catch(done);
    });
  });

});
