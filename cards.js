/*
 * cards, an view navigation lib. Version 0.1.0.
 * Copyright 2013-2015, Mozilla Foundation
 */

define(function(require, exports, module) {

'use strict';

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

  /**
   * If a lazy load is causing us to have to wait before we insert a card, this
   * is the type of card we are planning to insert.
   */
  _pendingInsert: null,

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
   * Holds promise resolution information that are resolved once the element
   * placed in the Map reaches the cardVisible event.
   */
  _cardVisibleResolves: new Map(),

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
   *     @case['leftHistory']{
   *       The card gets inserted to the left of the current card, and treated
   *       as a historical card for the activeCard.
   *     }
   *   }
   * ]
   */
  pushCard: function(showMethod, type, args, placement) {
    return this.insertCard(type, args, placement).then((domNode) => {
      var promise = new Promise((resolve) => {
        // Do not care about rejections here for simplicity. Could revisit
        // if there are errors that should be bubbled out later.
        this._cardVisibleResolves.set(domNode, resolve);
      });

      this.showCard(this.getIndexForCard(domNode), showMethod, 'forward');

      return promise;
    });
  },

  insertCard: function(type, args, placement) {
    var resolve,
        cardDef = this._cardDefs[type],
        promise = new Promise(function(r) {
          // Do not care about rejections here for simplicity. Could revisit
          // if there are errors that should be bubbled out later.
          resolve = r;
        });

    args = args || {};

    if (!cardDef) {
      var cbArgs = Array.from(arguments);
      this._pendingInsert = [type];

      // Avoid clicks while loading a card, to avoid insertion orders from
      // going haywire. The event eating is just binary, so best to not also
      // trigger a bunch of insertions programmatically, wait for promise
      // resolutions.
      this.eatEventsUntilNextCard();

      require([this.typeToModuleId(type)], (Ctor) => {
        this._cardDefs[type] = Ctor;
        this.insertCard.apply(this, cbArgs).then((domNode) => {
          this.stopEatingEvents();
          resolve(domNode);
        });
      });
      return promise;
    }

    this._pendingInsert = null;

    var domNode = args.cachedNode || new cardDef();
    domNode.classList.add('card');

    this.emit('cardCreated', type, domNode);

    if (args && domNode.onArgs) {
      domNode.onArgs(args);
    }

    var cardIndex, insertBuddy;
    if (!placement) {
      cardIndex = this._cardStack.length;
      insertBuddy = null;
      domNode.classList.add(cardIndex === 0 ? 'before' : 'after');
    } else if (placement === 'left') {
      cardIndex = this.activeCardIndex++;
      insertBuddy = this.cardsNode.children[cardIndex];
      domNode.classList.add('before');
    } else if (placement === 'right') {
      cardIndex = this.activeCardIndex + 1;
      if (cardIndex >= this._cardStack.length) {
        insertBuddy = null;
      } else {
        insertBuddy = this.cardsNode.children[cardIndex];
      }
      domNode.classList.add('after');
    } else if (placement === 'leftHistory') {
      cardIndex = Math.max(this.activeCardIndex - 1, 0);
      insertBuddy = this.cardsNode.children[this.activeCardIndex];
      domNode.classList.add('before');
      this.activeCardIndex += 1;
    }

    this._cardStack.splice(cardIndex, 0, domNode);

    if (!args.cachedNode) {
      this.cardsNode.insertBefore(domNode, insertBuddy);
    }

    if ('postInsert' in domNode) {
      domNode.postInsert();
    }
    this.emit('postInsert', domNode);

    // make sure the reflow sees the new node so that the animation
    // later is smooth.
    if (!args.cachedNode) {
      domNode.clientWidth;
    }

    resolve(domNode);
    return promise;
  },

  getIndexForCard: function(domNode) {
    for (var i = this._cardStack.length - 1; i >= 0; i--) {
      var stackNode = this._cardStack[i];
      if (domNode === stackNode) {
        return i;
      }
    }
    return -1;
  },

  isVisible: function(domNode) {
    return !!(domNode &&
              domNode.classList.contains('center'));
  },

  getCurrentCardType: function() {
    var result = null,
        card = this.getActiveCard();

    // Favor any _pendingInsert value as it is about to
    // become current, just waiting on an async cycle
    // to finish. Otherwise use current card value.
    if (this._pendingInsert) {
      result = this._pendingInsert;
    } else if (card) {
      result = cards.elementToType(card);
    }
    return result;
  },

  /* @args[
   *   @param[showMethod @oneof[
   *     @case['animate']{
   *       Perform an animated scrolling transition.
   *     }
   *     @case['immediate']{
   *       Immediately warp to the card without animation.
   *     }
   *   ]]
   * ]
   */
  /**
   * Goes "back" from the current active card one card step.
   * @param  {String} showMethod 'animate' or 'immediate'.
   * @return {Promise} Promise resolved to the next card that becomes visible
   *         after the back step.
   */
  back: function(showMethod) {
    if (!this._cardStack.length) {
      return;
    }

    var cardDomNode = this.getActiveCard();

    if (this._cardStack.length === 1) {
      // reset the z-index to 0 since we may have cards in the stack that
      // adjusted the z-index (and we are definitively clearing all cards).
      this._zIndex = 0;

      // No card to go to when done, so ask for a default
      // card and continue work once it exists.
      return cards.insertDefaultCard().then(() => {
        return this.back(showMethod);
      });
    }

    var nextCardIndex = this.activeCardIndex - 1;
    if (nextCardIndex === -1) {
      throw new Error('No next card');
    }

    var promise = new Promise((resolve) => {
      // Do not care about rejections here for simplicity. Could revisit if
      // there are errors that should be bubbled out later.
      this._cardVisibleResolves.set(this._cardStack[nextCardIndex], resolve);
    });

    this.showCard(nextCardIndex, showMethod, 'back');

    // Reset aria-hidden attributes to handle cards visibility.
    this._setScreenReaderVisibility();

    return promise.then((node) => {
      this.removeCard(cardDomNode);
      return node;
    });
  },

  /**
   * Shortcut for removing all the cards
   */
  removeAllCards: function() {
    for (var i = this._cardStack.length - 1; i > -1; i++) {
      this.removeCard(this._cardStack[i]);
    }
  },

  /**
   * Just removes a card from the stack, no special animations. Use back() if
   * wanting to remove with animation.
   */
  removeCard: function(domNode) {
    var index = this.getIndexForCard(domNode);
    if (index === -1) {
      throw new Error('DOM node not found: ' + domNode.nodeName.toLowerCase());
    }

    // If the remove is for a DOM node that used anim-overlay, which would have
    // increased the _zIndex when added, adjust the zIndex appropriately.
    if (domNode && domNode.classList.contains('anim-overlay')) {
      this._zIndex -= 10;
    }

    try {
      if (domNode.release) {
        domNode.release();
      }
    }
    catch (ex) {
      console.warn('Problem cleaning up card:', ex, '\n', ex.stack);
    }

    if (index < this.activeCardIndex) {
      this.activeCardIndex -= 1;
    }

    this._cardStack.splice(index, 1);
    domNode.parentNode.removeChild(domNode);
  },

  getActiveCard: function() {
    return this._cardStack[this.activeCardIndex];
  },

  showCard: function(cardIndex, showMethod, navDirection) {
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

    if (this.activeCardIndex > this._cardStack.length - 1) {
      throw new Error('Invalid activeCardIndex: ' + this.activeIndex);
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
    } else {
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

    // Finish out the resolution of the pushCard promise and clean up. resolve
    // might not exist, in the case of a remove, the previous card is shown.
    var resolve = this._cardVisibleResolves.get(domNode);
    if (resolve) {
      this._cardVisibleResolves.delete(domNode);
      resolve(domNode);
    }
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

