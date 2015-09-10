/*
 * cards, an view navigation lib. Version 2.0.0.
 * Copyright 2013-2015, Mozilla Foundation
 */

define(function(require, exports, module) {

'use strict';

var cardsInit = require('cards_init'),
    evt = require('evt'),
    transitionEnd = require('transition_end');

function addClass(element, name) {
  if (element) {
    element.classList.add(name);
  }
}

function removeClass(element, name) {
  if (element) {
    element.classList.remove(name);
  }
}

/**
 * Fairly simple card abstraction with support for simple horizontal animated
 * transitions.  We are cribbing from deuxdrop's mobile UI's cards.js
 * implementation created jrburke.
 */
var cards = {
  /**
   * The ".cards" node that holds the cards.
   */
  cardsNode: null,

  /**
   * Tracks which index in the _cardStack is the active, visible card.
   * @type {Number}
   */
  activeCardIndex: -1,

  /**
   * Holds card definitions loaded by add/insert calls. If there is
   * no existing definition, the card module is dynamically loaded then placed
   * in _cardDefs.
   */
  _cardDefs: {},

  /*
   * Existing cards stored here. New cards getting added onto the bottom of the
   * stack.
   */
  _cardStack: [],

  /**
   * If a lazy load is causing us to have to wait before we insert a card, this
   * is the type of card we are planning to insert.
   */
  _pendingInsert: null,

  /**
   * Cards can stack on top of each other, make sure the stacked set is
   * visible over the lower sets. It is possible for this to not return to a
   * zero value if anim-overlay cards are remove()'d directly and not
   * through usage of back(). The long term solution is to allow instances of
   * card stacks inside cards, but that is a bigger overhaul. This will get
   * reset to zero though if all cards are removed and the stack starts over.
   */
  _zIndex: 0,

  /**
   * Tracks the number of transition events per card animation. Since each
   * animation ends up with two transitionend events since two cards are
   * moving, need to wait for the last one to be finished before doing
   * cleanup, like DOM removal.
   */
  _transitionCount: 0,

  /**
   * Are we eating all click events we see until we transition to the next
   * card (possibly due to a call to add() that has not yet occurred?).
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

  /**
   * Converts the card type, passed to methods like add and insert,
   * into a module ID that can be dynamically loaded. This is useful to allow
   * shorter, app-specific names that resolve to more complete names for module
   * loading, which may include loader plugin use.
   * @param  {String} type The card type
   * @return {String} The module ID.
   */
  typeToModuleId: function(type) {
    return type;
  },

  /**
   * Given a card element, return its card type. This allows the types to be
   * shorter, app-specific names where the custom element may need more unique,
   * longer names to not collide with other elements in the page. That custom
   * element name may also be tied more directly with the module ID it was used
   * to load it.
   * @param  {Element} element The DOM element for the card.
   * @return {String} The card type.
   */
  elementToType: function(element) {
    return element.nodeName.toLowerCase();
  },

  /**
   * Add a card onto the card-stack.
   * @param  {String} showMethod 'animate' or 'immediate'.
   * @param  {String} type Passed to insert, see notes there.
   * @param  {Object} [args] Passed to insert, see notes there.
   * @param  {String} [placement] Passed to insert, see notes there.
   * @return {Promise} Resolves to the card instance once it has been placed
   * in the DOM and is now the visible card, animation to the card has been
   * completed.
   */
  add: function(showMethod, type, args, placement) {
    return this.insert(type, args, placement).then((element) => {
      var promise = new Promise((resolve) => {
        // Do not care about rejections here for simplicity. Could revisit
        // if there are errors that should be bubbled out later.
        this._cardVisibleResolves.set(element, resolve);
      });

      this._showCard(this.getIndexForCard(element), showMethod, 'forward');

      return promise;
    });
  },

  /**
   * Inserts a card into the stack.
   *
   * @param  {String} type The type of card to insert. cards.typeToModuleId() is
   * used to translate that type into a module ID for loading.
   *
   * @param  {Object} [args] Optional args object to pass to the created card.
   * The created card's .args property will be set to this object, and if the
   * card has an onArgs method on it, it will be called with this object.
   *
   * @param  {String} [placement] where to place the card in the stack, and
   * how it should be considered in the history of cards. Possible values:
   *
   * - (no value): This should be the heavily favored, and is the default,
   * option. Card placed at end of stack, regardless of the position of the
   * active card. Considered a card in the future, relative to active card.
   *
   * - 'previous': Added before active card, and considered a card in the past,
   * relative to the active card.
   *
   * - 'next': Card placed after active card, which may not be at the end of the
   * card stack. Considered a card in the future, relative to active card.
   * Usually the (no value) choice for placement should be used over this
   * choice.
   *
   * - 'previousAsFuture': Card placed before the active card, but considered a
   * card in the future, relative to the active card. Useful for side/menu cards
   * that peek out from the opposite side of the normal navigation direction.
   *
   * @return {Promise} Resolves to the card instance once it has been placed
   * in the DOM. The card may not be visible at that point, just in the DOM of
   * the document.
   */
  insert: function(type, args, placement) {
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
        this.insert.apply(this, cbArgs).then((element) => {
          this.stopEatingEvents();
          resolve(element);
        });
      });
      return promise;
    }

    this._pendingInsert = null;

    var element = args.cachedNode || new cardDef();
    element.classList.add('card');

    this.emit('cardCreated', type, element);

    element.args = args || {};

    if (args && element.onArgs) {
      element.onArgs(args);
    }

    var cardIndex, insertBuddy;
    if (!placement) {
      cardIndex = this._cardStack.length;
      insertBuddy = null;
      element.classList.add(cardIndex === 0 ? 'before' : 'after');
    } else if (placement === 'previousAsFuture') {
      cardIndex = this.activeCardIndex++;
      insertBuddy = this.cardsNode.children[cardIndex];
      element.classList.add('before');
    } else if (placement === 'next') {
      cardIndex = this.activeCardIndex + 1;
      if (cardIndex >= this._cardStack.length) {
        insertBuddy = null;
      } else {
        insertBuddy = this.cardsNode.children[cardIndex];
      }
      element.classList.add('after');
    } else if (placement === 'previous') {
      cardIndex = Math.max(this.activeCardIndex - 1, 0);
      insertBuddy = this.cardsNode.children[this.activeCardIndex];
      element.classList.add('before');
      this.activeCardIndex += 1;
    }

    this._cardStack.splice(cardIndex, 0, element);

    if (!args.cachedNode) {
      this.cardsNode.insertBefore(element, insertBuddy);
    }

    if ('postInsert' in element) {
      element.postInsert();
    }
    this.emit('postInsert', element);

    // Make sure layout sees the new node so that the animation later is smooth.
    if (!args.cachedNode) {
      element.clientWidth;
    }

    resolve(element);
    return promise;
  },

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

    var startElement = this.getActiveCard();

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

    this._showCard(nextCardIndex, showMethod, 'back');

    // Reset aria-hidden attributes to handle cards visibility.
    this._setScreenReaderVisibility();

    return promise.then((element) => {
      this.remove(startElement);
      return element;
    });
  },

  /**
   * Just removes a card from the stack, no special animations. Use back() if
   * wanting to remove with animation.
   */
  remove: function(element) {
    var index = this.getIndexForCard(element);
    if (index === -1) {
      throw new Error('DOM node not found: ' + element.nodeName.toLowerCase());
    }

    // If the remove is for a DOM node that used anim-overlay, which would have
    // increased the _zIndex when added, adjust the zIndex appropriately.
    if (element && element.classList.contains('anim-overlay')) {
      this._zIndex -= 10;
    }

    try {
      if (element.release) {
        element.release();
      }
    }
    catch (ex) {
      console.warn('Problem cleaning up card:', ex, '\n', ex.stack);
    }

    if (index <= this.activeCardIndex) {
      this.activeCardIndex -= 1;
    }

    this._cardStack.splice(index, 1);
    element.parentNode.removeChild(element);
  },

  /**
   * Shortcut for removing all the cards
   */
  removeAll: function() {
    for (var i = this._cardStack.length - 1; i > -1; i--) {
      this.remove(this._cardStack[i]);
    }
  },

  /**
   * Remove cards between the active card and the element that represents
   * another card. This allows back() to work nicely between active card and the
   * supplied card element.
   * @param  {Element} element
   */
  removeBetweenActive: function(element) {
    var startIndex = this.getIndexForCard(element);
    if (startIndex === -1) {
      return;
    }

    // Do not want to remove the element, but the one past it.
    startIndex += 1;

    // remove() adjusts activeCardIndex, and want to stop when the
    // activeCardIndex gets to the startIndex, which is one greater than
    // the target element.
    while (this.activeCardIndex > startIndex) {
      this.remove(this._cardStack[startIndex]);
    }
  },

  getActiveCard: function() {
    return this._cardStack[this.activeCardIndex];
  },

  getIndexForCard: function(element) {
    for (var i = this._cardStack.length - 1; i >= 0; i--) {
      var stackNode = this._cardStack[i];
      if (element === stackNode) {
        return i;
      }
    }
    return -1;
  },

  isVisible: function(element) {
    return !!(element &&
              element.classList.contains('center'));
  },

  /**
   * @return {String}
   */
  getActiveCardType: function() {
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

    if (this.activeCardIndex > this._cardStack.length - 1) {
      throw new Error('Invalid activeCardIndex: ' + this.activeIndex);
    }

    if (this.activeCardIndex === -1) {
      this.activeCardIndex = cardIndex === 0 ? cardIndex : cardIndex - 1;
    }

    var element = (cardIndex !== null) ? this._cardStack[cardIndex] : null;
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

      // Make sure layout sees the transition is turned off.
      cardsNode.clientWidth;
      // explicitly clear since there will be no animation
      this._eatingEventsUntilNextCard = false;
    } else {
      this._transitionCount = (beginNode && endNode &&
                              // If going back to a card that used to have an
                              // anim-overlay after it, but that card was
                              // rmoved, the endNode is already in center
                              // position, so will only get one card animating.
                              !endNode.classList.contains('center')) ? 2 : 1;
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

      this._onCardVisible(element);
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
   * @param  {Card} element The card instance.
   */
  _onCardVisible: function(element) {
    if (element.onCardVisible) {
      element.onCardVisible();
    }
    this.emit('cardVisible', element);

    // Finish out the resolution of the add() promise and clean up. resolve
    // might not exist, in the case of a remove, the previous card is shown.
    var resolve = this._cardVisibleResolves.get(element);
    if (resolve) {
      this._cardVisibleResolves.delete(element);
      resolve(element);
    }
  },

  /**
   * Helper that causes (some) events targeted at our cards to be eaten until
   * we get to the next card.  The idea is to avoid bugs caused by the user
   * still being able to click things while our cards are transitioning or
   * while we are performing a (reliable) async wait before we actually initiate
   * an add() in response to user stimulus.
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
   * If the tray is active and a click happens in the tray area, transition
   * back to the visible thing (which must be to our right currently.)
   */
  _onMaybeIntercept: function(event) {
    if (this._eatingEventsUntilNextCard) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
  }
};

evt.mix(cards);

return cards;

});

