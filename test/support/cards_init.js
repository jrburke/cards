define(function(require) {
  'use strict';

  return function(cards) {

    cards.elementToType = function(element) {
      return element.nodeName.toLowerCase();
    };

    cards.typeToModuleId = function(type) {
      return 'element!' + type;
    };

  };
});
