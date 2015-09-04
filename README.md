# cards

A module that handles the placement and animation of UI card views.

Extracted from the Gaia email app used in Firefox OS.

This module is targeted to hand-held mobile devices where just one UI view, or
card in the parlance of this module, is shown at a time. The

## Prerequisites

Assumes a browser that provides:

* transitionend
* Promise
* Some ES6 support, mainly arrow functions
* Custom elements (just document.registerElement, for card definitions)

It is implemented as an AMD module since one of the primary goals of this module
is to dynamically load the cards as they are needed.

## Dependencies

* evt
* transition_end

It also depends on a module called ```'cards_init'```. The app provides this
module to help set up some app-specific parts for the cards module. See the
cards_init API section for more details.

### HTML API

The cards module wants to bind to an HTML structure that looks like so:

```html
<!-- This div should be sized to the viewport via CSS -->
<div class="cardsContainer">
  <!-- This div holds the cards and will end being wider than the viewport -->
  <div class="cards"></div>
</div>
```

This module is not set up as a custom element that can create this inner DOM
itself. This is to allow a fast cache restore of HTML into the inner cards
element before custom element definitions are even defined.

## CSS API

See the cards.css in this repo for the CSS to define for the cards to work.
Include that CSS in your project.

## JS API

xx

cards.init();
cards.pushCard();
cards.removeCard();

## cards_init API.

xx

## Card modules

Assumes the cards are defined as an AMD module whose export is a custom element
constructor.

The custom element can provide the following functions that interact with the
cards infrastructure:

* onArgs
* postInsert
* onCardVisible
* told
* release

## License

[Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)