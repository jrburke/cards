(function() {
  'use strict';

  var tests = [
    'basic',
    'remove-middle',
    'default-card',
    'remove-all-add',
    'remove-between-active',
    'anim-overlay-back-then',

    // Do this one last, it takes longer
    'z-index'
  ];


  var urlSuffix,
      runIndex = 0,
      runState = 'stopped';

  function getId(id) {
    return document.getElementById(id);
  }

  function resetRun() {
    runIndex = 0;
    urlSuffix = '?time=' + Date.now();
  }

  /*** List out the tests ***/
  var html = '';
  tests.forEach(function(test, i) {
    html += `<li id="test-${test}" class="testItem">
               <a href="${test}/test.html">${test}</a>
            </li>`;
  });
  getId('tests').innerHTML = html;


  /*** Test running ***/
  function resetSelectState() {
    Array.from(document.querySelectorAll('.testItem')).forEach(function(node) {
      node.classList.remove('selected');
    });
  }

  function resetTestState() {
    Array.from(document.querySelectorAll('.testItem')).forEach(function(node) {
      node.classList.remove('success', 'failure');
    });
  }

  function runTest() {
    resetSelectState();

    if (runIndex >= tests.length) {
      runState = 'stopped';
      getId('goButton').textContent = 'Go';
      return;
    }

    var testName = tests[runIndex];
    var li = getId('test-' + testName);
    li.classList.add('selected');
    runIndex += 1;
    getId('testFrame').src = testName + '/test.html?time=' + Date.now();
  }

  window.addEventListener('message', function(event) {
    // Nice to have, check event.origin, but nothing volatile is done with the
    // tests, so OK to pass on it for now.
    var {id, failures} = event.data;

    getId('test-' + id).classList.add(failures ? 'failure': 'success');
    runTest();
  }, false);

  /*** Wire up the controls ***/

  function onGoClick(evt) {
    if (runState === 'stopped') {
      getId('goButton').textContent = 'Running';
      runState = 'running';
      resetRun();
      resetSelectState();
      resetTestState();
      runTest();
    } else {
      runState = 'stopped';
      getId('goButton').textContent = 'Go';
      resetSelectState();
      getId('testFrame').src = 'about:blank';
    }
  }
  getId('goButton').addEventListener('click', onGoClick);

}());
