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

      co(function* () {
        yield cards.pushCard('immediate', 'first-card');
        //z-index
        yield cards.pushCard('animate', 'second-card');
        yield cards.pushCard('animate', 'third-card');
        //z-index
        yield cards.pushCard('animate', 'second-card');
        yield cards.pushCard('animate', 'first-card');
        yield cards.pushCard('animate', 'third-card');
        //z-index
        yield cards.pushCard('animate', 'second-card');
        yield cards.pushCard('animate', 'third-card');
        yield cards.pushCard('animate', 'third-card');
        yield cards.pushCard('animate', 'first-card');
        yield cards.back('animate');
        yield cards.back('animate');
        yield cards.back('animate');
        yield cards.back('animate');
        //z-index
        yield cards.pushCard('animate', 'second-card');
        yield cards.pushCard('animate', 'third-card');
        yield cards.pushCard('animate', 'first-card');
        yield cards.back('animate');
        yield cards.back('animate');
        yield cards.back('animate');
        yield cards.back('animate');
        //z-index
        yield cards.pushCard('animate', 'second-card');
        yield cards.back('animate');
        yield cards.back('animate');
        yield cards.back('animate');
        yield cards.back('animate');
        yield cards.back('animate');

        assert.equal(1, document.querySelectorAll('.card').length);
        assert.equal(true, !!qs('first-card'));
        assert.equal(0, cards._zIndex);
      })
      .then(done)
      .catch(done);
    });
  });

});
