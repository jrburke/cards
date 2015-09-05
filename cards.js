'use strict';
define(function(require, exports, module) {

var cardsInit = require('cards_init'),
    evt = require('evt'),
    transitionEnd = require('transition_end');

function addClass(domNode, name) {
  if (domNode) {
    domNode.classList.add(name);
  }
}

function removeClass(domNode, name) {
  if (domNode) {
    domNode.classList.remove(name);
  }
}

/**
 * Fairly simple card abstraction with support for simple horizontal animated
 * transitions.  We are cribbing from deuxdrop's mobile UI's cards.js
 * implementation created jrburke.
 */
var cards = {
  _cardDefs: {},

  /*
   * Existing cards, left-to-right, new cards getting pushed onto the right.
   */
  _cardStack: [],

  activeCardIndex: -1,
  /*
   * @oneof[null @listof[cardName modeName]]{
   *   If a lazy load is causing us to have to wait before we push a card, this
   *   is the type of card we are planning to push.
   * }
   */
  _pendingPush: null,

  /**
   * Cards can stack on top of each other, make sure the stacked set is
   * visible over the lower sets.
   */
  _zIndex: 0,

  /**
   * The "#cards" node that holds the cards; it is as wide as all of the cards
   * it contains and has its left offset changed in order to change what card
   * is visible.
   */
  cardsNode: null,

  /**
   * The DOM nodes that should be removed from their parent when our current
   * transition ends.
   */
  _animatingDeadDomNodes: [],

  /**
   * Tracks the number of transition events per card animation. Since each
   * animation ends up with two transitionend events since two cards are
   * moving, need to wait for the last one to be finished before doing
   * cleanup, like DOM removal.
   */
  _transitionCount: 0,

  /**
   * Are we eating all click events we see until we transition to the next
   * card (possibly due to a call to pushCard that has not yet occurred?).
   * Set by calling `eatEventsUntilNextCard`.
   */
  _eatingEventsUntilNextCard: false,

  /**
   * Holds promise resolution information to return from the pushCard calls.
   */
  _pushedResolves: new Map(),

  /**
   * Initialize and bind ourselves to the DOM which should now be fully loaded.
   */
  init: function(cardsSelector) {
    this.cardsNode = document.querySelector(cardsSelector || '.cards');

    this.cardsNode.addEventListener('click',
                                    this._onMaybeIntercept.bind(this),
                                    true);

    // XXX be more platform detecty. or just add more events. unless the
    // prefixes are already gone with webkit and opera?
    transitionEnd(this.cardsNode, this._onTransitionEnd.bind(this), false);

    // Listen for visibility changes to let current card know of them too.
    // Do this here instead of each card needing to listen, and needing to know
    // if it is also the current card.
    document.addEventListener('visibilitychange', (evt) => {
      var card = this.getActiveCard();
      if (card && card.onCurrentCardDocumentVisibilityChange) {
        card.onCurrentCardDocumentVisibilityChange(document.hidden);
      }
    });

    cardsInit(this);
  },

  typeToModuleId: function(type) {
    return type;
  },

  elementToType: function(element) {
    return element.nodeName.toLowerCase();
  },

  /**
   * If the tray is active and a click happens in the tray area, transition
   * back to the visible thing (which must be to our right currently.)
   */
  _onMaybeIntercept: function(event) {
    if (this._eatingEventsUntilNextCard) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // Find the card containing the event target.
    var cardNode = event.target;
    for (cardNode = event.target; cardNode; cardNode = cardNode.parentElement) {
      if (cardNode.classList.contains('card')) {
        break;
      }
    }
  },

  /**
   * Push a card onto the card-stack.
   */
  /* @args[
   *   @param[type]
   *   @param[showMethod @oneof[
   *     @case['animate']{
   *       Perform an animated scrolling transition.
   *     }
   *     @case['immediate']{
   *       Immediately warp to the card without animation.
   *     }
   *     @case['none']{
   *       Don't touch the view at all.
   *     }
   *   ]]
   *   @param[args Object]{
   *     An arguments object to provide to the card's constructor when
   *     instantiating.
   *   }
   *   @param[placement #:optional @oneof[
   *     @case[undefined]{
   *       The card gets pushed onto the end of the stack.
   *     }
   *     @case['left']{
   *       The card gets inserted to the left of the current card.
   *     }
   *     @case['right']{
   *       The card gets inserted to the right of the current card.
   *     }
   *   }
   * ]
   */
  pushCard: function(type, showMethod, args, placement) {
    var resolve,
        cardDef = this._cardDefs[type],
        promise = new Promise(function(r) {
          // Do not care about rejections here for simplicity. Could revisit
          // if there are errors that should be bubbled out later.
          resolve = r;
        });

    args = args || {};

    if (!cardDef) {
      var cbArgs = Array.slice(arguments);
      this._pendingPush = [type];

      // Only eat clicks if the card will be visibly displayed.
      if (showMethod !== 'none') {
        this.eatEventsUntilNextCard();
      }

      require([this.typeToModuleId(type)], (Ctor) => {
        this._cardDefs[type] = Ctor;
        this.pushCard.apply(this, cbArgs).then(resolve);
      });
      return promise;
    }

    this._pendingPush = null;

    var domNode = args.cachedNode || new cardDef();
    domNode.classList.add('card');

    this._pushedResolves.set(domNode, resolve);

    this.emit('cardCreated', type, domNode);

    if (args && domNode.onArgs) {
      domNode.onArgs(args);
    }

    var cardIndex, insertBuddy;
    if (!placement) {
      cardIndex = this._cardStack.length;
      insertBuddy = null;
      domNode.classList.add(cardIndex === 0 ? 'before' : 'after');
    }
    else if (placement === 'left') {
      cardIndex = this.activeCardIndex++;
      insertBuddy = this.cardsNode.children[cardIndex];
      domNode.classList.add('before');
    }
    else if (placement === 'right') {
      cardIndex = this.activeCardIndex + 1;
      if (cardIndex >= this._cardStack.length) {
        insertBuddy = null;
      } else {
        insertBuddy = this.cardsNode.children[cardIndex];
      }
      domNode.classList.add('after');
    }
    this._cardStack.splice(cardIndex, 0, domNode);

    if (!args.cachedNode) {
      this.cardsNode.insertBefore(domNode, insertBuddy);
    }

    if ('postInsert' in domNode) {
      domNode.postInsert();
    }

    this.emit('postInsert', domNode);

    if (showMethod !== 'none') {
      // make sure the reflow sees the new node so that the animation
      // later is smooth.
      if (!args.cachedNode) {
        domNode.clientWidth;
      }

      this._showCard(cardIndex, showMethod, 'forward');
    }

    if (args.onPushed) {
      args.onPushed(domNode);
    }

    return promise;
  },

  _findCardUsingType: function(type) {
    for (var i = 0; i < this._cardStack.length; i++) {
      var domNode = this._cardStack[i];
      if (cards.elementToType(domNode) === type) {
        return i;
      }
    }
  },

  _findCard: function(query, skipFail) {
    var result;
    if (typeof query === 'string') {
      result = this._findCardUsingType(query, skipFail);
    } else if (typeof(query) === 'number') { // index number
      result = query;
    } else {
      // query is a DOM node in this case
      result = this._cardStack.indexOf(query);
    }

    if (result > -1) {
      return result;
    } else if (!skipFail) {
      throw new Error('Unable to find card with query:', query);
    } else {
      // Returning undefined explicitly so that index comparisons are correct.
      return undefined;
    }
  },

  isVisible: function(domNode) {
    return !!(domNode &&
              domNode.classList.contains('center'));
  },

  getCurrentCardType: function() {
    var result = null,
        card = this.getActiveCard();

    // Favor any _pendingPush value as it is about to
    // become current, just waiting on an async cycle
    // to finish. Otherwise use current card value.
    if (this._pendingPush) {
      result = this._pendingPush;
    } else if (card) {
      result = cards.elementToType(card);
    }
    return result;
  },

  /**
   * Remove the card identified by its DOM node and all the cards to its right.
   * Pass null to remove all of the cards! If cardDomNode passed, but there
   * are no cards before it, cards.getDefaultCard is called to set up a before
   * card.
   */
  /* @args[
   *   @param[cardDomNode]{
   *     The DOM node that is the first card to remove; all of the cards to its
   *     right will also be removed.  If null is passed it is understood you
   *     want to remove all cards.
   *   }
   *   @param[showMethod @oneof[
   *     @case['animate']{
   *       Perform an animated scrolling transition.
   *     }
   *     @case['immediate']{
   *       Immediately warp to the card without animation.
   *     }
   *     @case['none']{
   *       Remove the nodes immediately, don't do anything about the view
   *       position.  You only want to do this if you are going to push one
   *       or more cards and the last card will use a transition of 'immediate'.
   *     }
   *   ]]
   *   @param[numCards #:optional Number]{
   *     The number of cards to remove.  If omitted, all the cards to the right
   *     of this card are removed as well.
   *   }
   *   @param[nextCardSpec #:optional]{
   *     If a showMethod is not 'none', the card to show after removal.
   *   }
   *   @param[skipDefault #:optional Boolean]{
   *     Skips the default pushCard if the removal ends up with no more
   *     cards in the stack.
   *   }
   * ]
   */
  removeCardAndSuccessors: function(cardDomNode, showMethod, numCards,
                                    nextCardSpec, skipDefault) {
    if (!this._cardStack.length) {
      return;
    }

    if (cardDomNode && this._cardStack.length === 1 && !skipDefault) {
      // No card to go to when done, so ask for a default
      // card and continue work once it exists.
      return cards.pushDefaultCard(() => {
        this.removeCardAndSuccessors(cardDomNode, showMethod, numCards,
                                    nextCardSpec);
      });
    }

    var firstIndex, iCard, domNode;
    if (cardDomNode === undefined) {
      throw new Error('undefined is not a valid card spec!');
    }
    else if (cardDomNode === null) {
      firstIndex = 0;
      // reset the z-index to 0 since we may have cards in the stack that
      // adjusted the z-index (and we are definitively clearing all cards).
      this._zIndex = 0;
    }
    else {
      for (iCard = this._cardStack.length - 1; iCard >= 0; iCard--) {
        domNode = this._cardStack[iCard];
        if (domNode === cardDomNode) {
          firstIndex = iCard;
          break;
        }
      }
      if (firstIndex === undefined) {
        throw new Error('No card represented by that DOM node');
      }
    }
    if (!numCards) {
      numCards = this._cardStack.length - firstIndex;
    }

    if (showMethod === 'none') {
      // If a 'none' remove, and the remove is for a DOM node that used
      // anim-overlay, which would have increased the _zIndex when added, adjust
      // the zIndex appropriately.
      if (cardDomNode && cardDomNode.classList.contains('anim-overlay')) {
        this._zIndex -= 10;
      }
    } else {
      var nextCardIndex = -1;
      if (nextCardSpec) {
        nextCardIndex = this._findCard(nextCardSpec);
      } else if (this._cardStack.length) {
        nextCardIndex = Math.min(firstIndex - 1, this._cardStack.length - 1);
      }

      if (nextCardIndex > -1) {
        this._showCard(nextCardIndex, showMethod, 'back');
      }
    }

    // Update activeCardIndex if nodes were removed that would affect its
    // value.
    if (firstIndex <= this.activeCardIndex) {
      this.activeCardIndex -= numCards;
      if (this.activeCardIndex < -1) {
        this.activeCardIndex = -1;
      }
    }

    var deadDomNodes = this._cardStack.splice(
                          firstIndex, numCards);
    for (iCard = 0; iCard < deadDomNodes.length; iCard++) {
      domNode = deadDomNodes[iCard];
      try {
        domNode.release();
      }
      catch (ex) {
        console.warn('Problem cleaning up card:', ex, '\n', ex.stack);
      }
      switch (showMethod) {
        case 'animate':
        case 'immediate': // XXX handle properly
          this._animatingDeadDomNodes.push(domNode);
          break;
        case 'none':
          domNode.parentNode.removeChild(domNode);
          break;
      }
    }

    // Reset aria-hidden attributes to handle cards visibility.
    this._setScreenReaderVisibility();
  },

  /**
   * Shortcut for removing all the cards
   */
  removeAllCards: function() {
    return this.removeCardAndSuccessors(null, 'none');
  },

  removeActiveCard: function(showMethod) {
    var card = this.getActiveCard();
    return this.removeCardAndSuccessors(card, showMethod);
  },

  getActiveCard: function() {
    return this._cardStack[this.activeCardIndex];
  },

  _showCard: function(cardIndex, showMethod, navDirection) {
    // Do not do anything if this is a show card for the current card.
    if (cardIndex === this.activeCardIndex) {
      return;
    }

    // If the active element is one that can have focus, blur it so that the
    // keyboard goes away.
    var activeElement = document.activeElement;
    if (activeElement && activeElement.blur) {
      activeElement.blur();
    }

    if (cardIndex > this._cardStack.length - 1) {
      // Some cards were removed, adjust.
      cardIndex = this._cardStack.length - 1;
    }
    if (this.activeCardIndex > this._cardStack.length - 1) {
      this.activeCardIndex = -1;
    }

    if (this.activeCardIndex === -1) {
      this.activeCardIndex = cardIndex === 0 ? cardIndex : cardIndex - 1;
    }

    var domNode = (cardIndex !== null) ? this._cardStack[cardIndex] : null;
    var beginNode = this.getActiveCard();
    var endNode = this._cardStack[cardIndex];
    var isForward = navDirection === 'forward';

    if (this._cardStack.length === 1) {
      // Reset zIndex so that it does not grow ever higher when all but
      // one card are removed
      this._zIndex = 0;
    }

    // If going forward and it is an overlay node, then do not animate the
    // beginning node, it will just sit under the overlay.
    if (isForward && endNode.classList.contains('anim-overlay')) {
      beginNode = null;

      // anim-overlays are the transitions to new layers in the stack. If
      // starting a new one, it is forward movement and needs a new zIndex.
      // Otherwise, going back to
      this._zIndex += 10;
    }

    // If going back and the beginning node was an overlay, do not animate
    // the end node, since it should just be hidden under the overlay.
    if (beginNode && beginNode.classList.contains('anim-overlay')) {
      if (isForward) {
        // If a forward animation and overlay had a vertical transition,
        // disable it, use normal horizontal transition.
        if (showMethod !== 'immediate') {
          if (beginNode.classList.contains('anim-vertical')) {
            removeClass(beginNode, 'anim-vertical');
            addClass(beginNode, 'disabled-anim-vertical');
          } else if (beginNode.classList.contains('anim-fade')) {
            removeClass(beginNode, 'anim-fade');
            addClass(beginNode, 'disabled-anim-fade');
          }
        }
      } else {
        this.emit('endCardChosen', endNode);
        endNode = null;
        this._zIndex -= 10;
      }
    }

    // If the zindex is not zero, then in an overlay stack, adjust zindex
    // accordingly.
    if (endNode && isForward && this._zIndex) {
      endNode.style.zIndex = this._zIndex;
    }

    var cardsNode = this.cardsNode;

    if (endNode) {
      this.emit('endCardChosen', endNode);
    }

    if (showMethod === 'immediate') {
      addClass(beginNode, 'no-anim');
      addClass(endNode, 'no-anim');

      // make sure the reflow sees the transition is turned off.
      cardsNode.clientWidth;
      // explicitly clear since there will be no animation
      this._eatingEventsUntilNextCard = false;
    }
    else if (showMethod === 'none') {
      // do not set _eatingEventsUntilNextCard, but don't clear it either.
    }
    else {
      this._transitionCount = (beginNode && endNode) ? 2 : 1;
      this._eatingEventsUntilNextCard = true;
    }

    if (this.activeCardIndex === cardIndex) {
      // same node, no transition, just bootstrapping UI.
      removeClass(beginNode, 'before');
      removeClass(beginNode, 'after');
      addClass(beginNode, 'center');
    } else if (this.activeCardIndex > cardIndex) {
      // back
      removeClass(beginNode, 'center');
      addClass(beginNode, 'after');

      removeClass(endNode, 'before');
      addClass(endNode, 'center');
    } else {
      // forward
      removeClass(beginNode, 'center');
      addClass(beginNode, 'before');

      removeClass(endNode, 'after');
      addClass(endNode, 'center');
    }

    if (showMethod === 'immediate') {
      // make sure the instantaneous transition is seen before we turn
      // transitions back on.
      cardsNode.clientWidth;

      removeClass(beginNode, 'no-anim');
      removeClass(endNode, 'no-anim');

      this._onCardVisible(domNode);
    }

    this.activeCardIndex = cardIndex;

    // Reset aria-hidden attributes to handle cards visibility.
    this._setScreenReaderVisibility();
  },

  _setScreenReaderVisibility: function() {
    // We use aria-hidden to handle visibility instead of CSS because there are
    // semi-transparent cards, such as folder picker.
    this._cardStack.forEach(function(card, index) {
      card.setAttribute('aria-hidden', index !== this.activeCardIndex);
    }, this);
  },

  _onTransitionEnd: function(event) {
    // Avoid other transitions except ones on cards as a whole.
    if (!event.target.classList.contains('card')) {
      return;
    }

    var activeCard = this.getActiveCard();
    // If no current card, this could be initial setup from cache, no valid
    // cards yet, so bail.
    if (!activeCard) {
      return;
    }

    // Multiple cards can animate, so there can be multiple transitionend
    // events. Only do the end work when all have finished animating.
    if (this._transitionCount > 0) {
      this._transitionCount -= 1;
    }

    if (this._transitionCount === 0) {
      if (this._eatingEventsUntilNextCard) {
        this._eatingEventsUntilNextCard = false;
      }
      if (this._animatingDeadDomNodes.length) {
        // Use a setTimeout to give the animation some space to settle.
        setTimeout(() => {
          this._animatingDeadDomNodes.forEach(function(domNode) {
            if (domNode.parentNode) {
              domNode.parentNode.removeChild(domNode);
            }
          });
          this._animatingDeadDomNodes = [];
        }, 100);
      }

      // If an vertical overlay transition was was disabled, if
      // current node index is an overlay, enable it again.
      var endNode = activeCard;

      if (endNode.classList.contains('disabled-anim-vertical')) {
        removeClass(endNode, 'disabled-anim-vertical');
        addClass(endNode, 'anim-vertical');
      } else if (endNode.classList.contains('disabled-anim-fade')) {
        removeClass(endNode, 'disabled-anim-fade');
        addClass(endNode, 'anim-fade');
      }

      // If any action to do at the end of transition trigger now.
      if (this._afterTransitionAction) {
        var afterTransitionAction = this._afterTransitionAction;
        this._afterTransitionAction = null;
        afterTransitionAction();
      }

      this._onCardVisible(activeCard);
    }
  },

  /**
   * Handles final notification of card visibility in the stack.
   * @param  {Card} domNode the card instance.
   */
  _onCardVisible: function(domNode) {
    if (domNode.onCardVisible) {
      domNode.onCardVisible();
    }
    this.emit('cardVisible', domNode);

    // Finish out the resolution of the pushCard promise and clean up.
    var resolve = this._pushedResolves.get(domNode);
    this._pushedResolves.delete(domNode);
    resolve(domNode);
  },

  /**
   * Helper that causes (some) events targeted at our cards to be eaten until
   * we get to the next card.  The idea is to avoid bugs caused by the user
   * still being able to click things while our cards are transitioning or
   * while we are performing a (reliable) async wait before we actually initiate
   * a pushCard in response to user stimulus.
   *
   * This is automatically triggered when performing an animated transition;
   * other code should only call this in the async wait case mentioned above.
   *
   * For example, we don't want the user to have 2 message readers happening
   * at the same time because they managed to click on a second message before
   * the first reader got displayed.
   */
  eatEventsUntilNextCard: function() {
    this._eatingEventsUntilNextCard = true;
  },

  /**
   * Stop eating events, presumably because eatEventsUntilNextCard was used
   * as a hack for a known-fast async operation to avoid bugs (where we knew
   * full well that we weren't going to show a card).
   */
  stopEatingEvents: function() {
    this._eatingEventsUntilNextCard = false;
  },

  /**
   * If there are any cards on the deck right now, log an error and clear them
   * all out.  Our caller is strongly asserting that there should be no cards
   * and the presence of any indicates a bug.
   */
  assertNoCards: function() {
    if (this._cardStack.length) {
      throw new Error('There are ' + this._cardStack.length + ' cards but' +
                      ' there should be ZERO');
    }
  }
};

evt.mix(cards);

return cards;

});

