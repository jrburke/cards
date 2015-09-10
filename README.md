# cards

A module that handles the placement and animation of UI card views.

Extracted from the Gaia email app used in Firefox OS.

This module is targeted to hand-held mobile devices where just one UI view, or
card in the parlance of this module, is shown at a time.

## Prerequisites

Assumes a browser that provides:

* transitionend
* Promise
* Some ES6 support, mainly arrow functions, Map.
* Custom elements (just document.registerElement, for card definitions)

It is implemented as an AMD module since one of the primary goals of this module
is to dynamically load the cards as they are needed.

## Dependencies

* evt
* transition_end

It also depends on a module called ```'cards_init'```. The app provides this
module to help set up some app-specific parts for the cards module. See the
cards_init API section for more details. Use your AMD loader config to point the
```'cards_init'``` module ID to the correct location.

### HTML API

The cards module wants to bind to this HTML:

```html
<!-- This div should be sized to the viewport via CSS -->
<div class="cards"></div>
```

This module is not set up as a custom element that can create this inner DOM
itself. This is to allow a fast cache restore of HTML into the inner cards
element before custom element definitions are even defined.

## CSS API

See `cards.css` in this repo for the CSS to define for the cards to work.
Include that CSS in your project.

More should be added here about an 'anim-overlay' card and how to get a vertical
card navigation vs the standard horizontal one. See the 'anim-vertical' and
'upflow.anim-vertical' CSS classes. If the card places these classes on its root
then vertical animations occur.

Ideally the add/back APIs will morph to specifying that information in the
JS call, to allow more flexibility and card navigation style localization to
the callers of those methods.

## JS API

The main APIs that will be used:

* `cards.init()`: binds to the HTML mentioned above and sets up the cards stack
for adds and removes.
* `cards.add('card_type', 'animate')`: adds a new card in the card stack.
Animates its appearance, based on the CSS values for the transition.
* `cards.back('animate')`: Removes the visible card.

## cards_init API.

The cards_init module is called during the cards module initialization, and
allows the app to override some methods on the cards object to control ID/type
translations and to set up inserting a default card when back() would end up in
no cards in the stack.

See `test/support/module_init` and `test/default-card/test.js` for module_init
examples.

## Card modules

Assumes the cards are defined as an AMD module whose export is a custom element
constructor.

The custom element can provide the following functions that interact with the
cards infrastructure:

* **onArgs**: called right after custom element creation, to pass an args object
that can be passed via the `cards.add` API. The args are added to the
element as an `args` property on the element before onArgs is called. So if the
args values are needed later they can be accessed there without implementing an
onArgs method.
* postInsert: called after the card has been inserted in the DOM, but before
any animation if 'animate' is in play.
* onCardVisible: called once the card becomes the visible card.
* release: called after the card has been removed from the DOM. Allows the card
to do cleanup before it is garbage collected.

## Tests

To run the tests, open `test/all.html` in a browser and press the "Go" button.
Each test is also invidually loadable for debugging support.

## License

[Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)

## todo

* anim-overlay, anim-vertical styles specified in the API calls instead of
needing the card definitions to set these themselves.


