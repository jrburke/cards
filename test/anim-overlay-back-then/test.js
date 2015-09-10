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
      this.classList.add('anim-fade', 'anim-overlay');
      this.innerHTML = '<h1>Card 2</h1>';
    }
  };
});
define('third-card', function(require) {
  return {
    createdCallback: function() {
      this.innerHTML = '<h1>Card 3</h1>';
    }
  };
});


define(function(require) {
  var cards = require('cards');

  function qs(query) {
    return document.querySelector(query);
  }

  cards.init();

  /**
   * Tests if second card an anim-overlay, it is removed, so first card is still
   * in "center" but under the third card. If that third card goes back to first
   * card, then only one transitionend happens in that case. This sort of
   * stacking behavior should be avoided (if an overlay, it should stay in the
   * deck), but want to be robust against failures, so account for it.
   */
  describe('anim-overlay-back-then', function() {
    it('anim-overlay, add card, back, trigger then()', function(done) {
      co(function* () {
        yield cards.add('immediate', 'first-card');
        yield cards.add('animate', 'second-card');
        yield cards.add('animate', 'third-card');

        cards.remove(qs('second-card'));

        yield cards.back('then');

        assert.equal(true, qs('first-card').classList.contains('center'));
        assert.equal(true, !qs('second-card'));
        assert.equal(1, cards._cardStack.length);
      })
      .then(done)
      .catch(done);
    });
  });

});
