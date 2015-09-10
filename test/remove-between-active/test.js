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
        var firstCard = yield cards.pushCard('immediate', 'first-card');
        yield cards.pushCard('animate', 'second-card');
        yield cards.pushCard('animate', 'first-card');
        yield cards.pushCard('animate', 'second-card');
        yield cards.pushCard('animate', 'third-card');

        cards.removeCardsBetweenActive(firstCard);

        assert.equal(2, cards._cardStack.length);
        assert.equal(true, !!qs('first-card'));
        assert.equal(true, !qs('second-card'));
        assert.equal(true, !!qs('third-card'));

        yield cards.back('animate');

        assert.equal(true, !!qs('first-card'));
        assert.equal(true, !qs('third-card'));
        assert.equal(1, cards._cardStack.length);
      })
      .then(done)
      .catch(done);
    });
  });

});