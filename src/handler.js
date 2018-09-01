// TODO partition the mess into es modules
// TODO more commenting / documenation
// TODO use Config API

import OptimalSelect from 'optimal-select';
import * as Log from 'loglevel';
import Inpladitor from './model';

const log = Log.debug;

function debug(...args) {
  if (Inpladitor.options.debug) log(...args);
}


function realShape(range) {
  const rects = range.getClientRects();

  const rect = range.getBoundingClientRect();

  const shape = {};

  let i = 0;
  function replaceIfMore(param) {
    shape[param] = Math.max(rect[param], rects[i][param], shape[param] || 0);
  }
  function replaceIfLess(param) {
    shape[param] = Math.min(rect[param], rects[i][param], shape[param] || Infinity);
  }
  for (i = 0; i < rects.length; i += 1) {
    ['x', 'y', 'top', 'left'].forEach(replaceIfLess);
    ['bottom', 'right'].forEach(replaceIfMore);
  }

  shape.width = shape.right - shape.left;
  shape.height = shape.bottom - shape.top;

  return shape;
}


function elementSelector(element) {
  return OptimalSelect(element, {
    ignore: {
      class(className) { return /(?=(\s|))(sortable|edited|save|stick|reset|hl-red|hl-orange|hl-green)(?=(\s|$))/.test(className); },
      attribute(name/* , value, defaultPredicate */) { return /^style$/.test(name); },
    },
  });
}


function childTextNodes(originalElement) {
  const element = originalElement;
  element.childTextNodes = [];
  // for (let i = 0, index = 0, n; n = element.childNodes[i++];) {
  let index = 0;
  Array.from(element.childNodes).forEach((n) => {
    const node = n;
    if (node.nodeType === Node.TEXT_NODE && (node.nodeValue.trim() !== '' || node.originalValue)) {
      element.childTextNodes.push(node);
      node.textNodeIndex = index;
      index += 1;
    }
  });
}

function makeChangesPermanent(options = {}) {
  const textNode = this;

  const parent = textNode.parentNode;

  let action = parent.getAttribute('data-field');
  if (!action && !parent.editAction) return false;
  let context = Blaze.getData(parent);

  let index = 0;

  const successCallback = function successCallback() {
    textNode.originalValue = textNode.nodeValue;
    textNode.resetButton.click();
    // textNode.removeButtons();
  };

  index = textNode.textNodeIndex;

  if (_.isFunction(parent.editAction)) {
    debug('custom editAction will be invoked', parent.editAction);

    if (options.dryRun) return true;

    parent.editAction.call(context, textNode.nodeValue, index, successCallback);
  } else if (_.isString(action)) {
    // get collection and method considering multiple textNodes ...
    action = action.indexOf('|') > -1 ? action.split('|')[index] : action;

    if (action === 'none') return false;

    let collection = parent.getAttribute('data-collection') || '';

    let method = parent.getAttribute('data-method') || '';

    const contextId = parent.getAttribute('data-context-id');

    let fields = action.split('.');

    // prepare context and field
    let contextIndex = 0;

    let field = false;

    const checkContextId = function checkContextId(checkContext = context, checkedFields = fields) {
      debug('checking context id', checkContext, checkedFields);

      let checkedContext = checkContext;
      for (let i = 0; i < checkedFields.length; i += 1) {
        checkedContext = checkedContext[checkedFields[i]];

        debug('i :', i, 'checking', checkedContext);

        if (checkedContext && checkedContext._id) {
          context = checkedContext;
          contextIndex = i + 1;
          fields = fields.slice(contextIndex);
          field = fields.join('.');
        }
      }

      debug('returning with', !!context._id, context, field);

      return !!context._id;
    };

    if (collection && collection.indexOf('|') > -1) collection = collection.split('|')[index];
    if (method && method.indexOf('|') > -1) method = method.split('|')[index];

    debug('check', context, method, collection, index, action);

    // get method and collection by inheritance (3 levels max depth)
    if ((!contextId && (!context[fields[0]] || !checkContextId())) || (!method && !collection)) {
      let depth = 0; let grandParent = parent; let
        maxDepth = grandParent.getAttribute('data-depth') || 3;

      while (
        ((!contextId && (!context[fields[0]] || !checkContextId()))
          || (!method && !collection)) && depth <= maxDepth
      ) {
        grandParent = grandParent.parentNode;
        maxDepth = grandParent.getAttribute('data-depth') || maxDepth;

        if (!method && !collection) {
          collection = grandParent.getAttribute('data-collection');
          method = grandParent.getAttribute('data-method');
        }

        if (!contextId && (!context[fields[0]] || !checkContextId())) {
          context = Blaze.getData(grandParent);
        }

        debug('depth', depth, context, method, collection);

        depth += 1;
      }
    }

    if (!field) field = fields[fields.length - 1];

    debug('context', context, fields, field);

    debug('requirements', context[fields[0]], checkContextId(), method, collection);

    // if we defined a depth data attribute on parent then don't insist the
    // context has the field .. maybe this field is optional
    if (parent.getAttribute('data-depth')) context[fields[0]] = undefined;

    if (
      (
        !contextId && (!Object.prototype.hasOwnProperty.call(context, fields[0])
          || !checkContextId())
      )
      || (!method && !collection)
    ) return false;

    if (contextId) context = { _id: contextId };

    method = method || `update${collection.replace(/s$/, '')}`;
    const modifier = {}; let
      value = textNode.nodeValue;
    if (value === '--') value = '';
    if (parent.editAlter) {
      modifier[field] = parent.editAlter.call(context, value, field, index);
    } else modifier[field] = value;

    debug(method, context._id, modifier);

    if (options.dryRun) return true;

    Meteor.call(method, context._id, modifier, (error) => {
      if (error) {
        // eslint-disable-next-line no-alert
        alert(`Could not save the new value : ${error.reason}`);
        log.error(`Error using in place editor (${method} -- ${field} => ${textNode.nodeValue})`, error.reason);
        return;
      }
      successCallback();
    });
  }

  return true;
  // end of makeChangesPermanent function definition
}


function applyEdits() {
  const pathEdits = Inpladitor._edits.findOne({ path: window.location.pathname });


  const affectedNodes = [];
  if (pathEdits) {
    pathEdits.edits.forEach((edit) => {
      Meteor.defer(() => {
        Tracker.afterFlush(() => {
          const parent = document.querySelector(edit.selector);


          const clickEvent = jQuery.Event('click');


          const range = document.createRange();


          const selection = window.getSelection();

          if (!parent) { Log.warn('Error applying edit of', edit.selector, ` #${edit.index} : element not found`); return; }

          clickEvent.currentTarget = parent;
          // create the array of child text nodes (with some text inside)
          if (!parent.childTextNodes) childTextNodes(parent);
          const textNode = parent.childTextNodes[edit.index];
          if (!textNode.textNodeIndex) childTextNodes(parent);

          // return if this index is not found (html changed)
          if (!textNode) { Log.warn(`Error applying edit for ${edit.selector} #${edit.index} : Text node not found`); return; }

          // return if original value is not the current (html changed or value updated by others)
          if (textNode.nodeValue !== edit.original && textNode.originalValue !== edit.original) {
            Log.warn(`Error applying edit for ${edit.selector} #${edit.index} : Original value mismatch !!`);
            return;
          }

          // we should only reach here if this is the element was originally edited
          textNode.stuckValue = edit.newValue;
          range.selectNodeContents(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
          Inpladitor.handler(clickEvent);
          const input = document.getElementById('editable-input');
          input.value = edit.newValue;
          let keyPressEvent = new KeyboardEvent('keyup', { keyCode: 46, which: 46, view: window });
          input.dispatchEvent(keyPressEvent);
          keyPressEvent = new KeyboardEvent('keypress', { keyCode: 13, which: 13, view: window });
          input.dispatchEvent(keyPressEvent);
          affectedNodes.push(textNode);
        });
      });
    });
  }
  Meteor.defer(() => {
    Tracker.afterFlush(() => {
      Array(...document.querySelectorAll('.edited')).forEach((editedParent) => {
        editedParent.childTextNodes.forEach((originalTextNode) => {
          const textNode = originalTextNode;
          if (typeof textNode.stuckValue !== 'undefined' && affectedNodes.indexOf(textNode) === -1) {
            if (
              (!Inpladitor.options.permissionCallback || Inpladitor.options.permissionCallback())
              && textNode.nodeValue !== textNode.stuckValue
            ) {
              delete textNode.stuckValue;
              textNode.stickButton.style.visibility = 'visible';
            } else textNode.resetButton.click();
          }
          // hide all buttons if user has no permission to use the editor
          if (Inpladitor.options.permissionCallback && !Inpladitor.options.permissionCallback()) {
            ['reset', 'save', 'stick'].forEach((op) => {
              if (textNode[`${op}Button`]) textNode[`${op}Button`].style.visibility = 'hidden';
            });
          }
        });
      });
    });
  });
  // end of applyEdits function definition
}

let sub;
const mutationObserver = new MutationObserver(((/* mutations */) => {
  applyEdits();
}));

// start observing DOM .. here we specify printable/editable areas
function observe() {
  Tracker.afterFlush(() => {
    // Array.apply(null, document.querySelectorAll('.editable')).forEach(function (element) {
    Array(...document.querySelectorAll(':not(.no-edit)')).forEach((el) => {
      const element = el;
      if (element.observed) return;
      mutationObserver.observe(element, { childList: true, subtree: true });
      element.observed = true;
    });
  });
}

// stop observing DOM .. Do not need the observer to fire for the upcoming
// changes (adding the editor textarea, buttons, ..etc)
function stopObserve() {
  mutationObserver.disconnect();
  Array(...document.querySelectorAll(':not(.no-edit)')).forEach((el) => {
    const element = el;
    element.observed = false;
  });
}

function nonObserved(callback) {
  // stop observer : do not re-apply edits after these DOM changes
  stopObserve();
  callback();
  // start observer again
  observe();
}

Inpladitor.start = function start() {
  observe(true);
  applyEdits();
  sub = Meteor.subscribe('Edits', window.location.pathname, { onReady() { applyEdits(); } });
};

Inpladitor.stop = function stop() {
  stopObserve();
  if (sub && sub.stop) sub.stop();
};

Meteor.startup(() => {
  Tracker.autorun(() => { Inpladitor.start(); });
});

// Initialize options
Inpladitor.options = {
  preserveLineBreaks: true,
  preserveWhiteSpace: false,
};

Inpladitor.handler = function handler(event/* , template */) {
  event.stopPropagation(); // stop bubbling up (do not fire event on parents)
  // disabled as the anchorNode/focusNode check seems enough
  // var textNode = false;
  // for (var i = 0; i < event.currentTarget.childNodes.length; i++) {
  //  var n = event.currentTarget.childNodes[i];
  //  if (n.nodeType == Node.TEXT_NODE && n.nodeValue.trim() !== "") { textNode = true; break; }
  // }
  // if (!textNode) return;
  const selection = document.getSelection();


  const parent = event.currentTarget;


  const textNode = selection.baseNode || selection.anchorNode || selection.focusNode;

  debug('entering editor event', textNode, parent);

  if (
    !textNode
    || !textNode.nodeValue
    || !textNode.nodeValue.trim()
    || textNode.parentNode !== parent
  ) return;

  const input = document.createElement('textarea');


  const parentStyle = window.getComputedStyle(parent);
  input.id = 'editable-input';
  input.placeholder = '--';

  // adjust style of parent element
  if (!parent.styleOriginal) parent.styleOriginal = {};
  const parentPosition = parentStyle.getPropertyValue('position');


  const parentWhiteSpace = parentStyle.getPropertyValue('white-space');


  const parentDisplay = parentStyle.getPropertyValue('display');


  const enableLineWrapping = parentWhiteSpace !== 'pre' && parentWhiteSpace !== 'nowrap';


  const preserveLineBreaks = parentWhiteSpace.indexOf('pre') === 0 || Inpladitor.options.preserveLineBreaks;


  const preserveWhiteSpace = parentWhiteSpace === 'pre' || parentWhiteSpace === 'pre-wrap' || Inpladitor.options.preserveWhiteSpace;

  if (parentPosition !== 'absolute') {
    if (typeof parent.styleOriginal.position === 'undefined') parent.styleOriginal.position = parent.style.position;
    parent.style.position = 'relative';
  }
  if (parentWhiteSpace !== 'pre' && parentWhiteSpace !== 'pre-wrap') {
    if (typeof parent.styleOriginal.whiteSpace === 'undefined') parent.styleOriginal.whiteSpace = parent.style.whiteSpace;
    if (parentWhiteSpace === 'nowrap') parent.style.whiteSpace = 'pre';
    else parent.style.whiteSpace = 'pre-wrap';
  }
  if (parentDisplay === 'inline') {
    if (typeof parent.styleOriginal.display === 'undefined') parent.styleOriginal.display = parent.style.display;
    parent.style.display = 'inline-block';
  }

  function resetParentStyle(force) {
    Object.keys(parent.styleOriginal).forEach((p) => {
      let styleValue = parent.styleOriginal[p];
      if (!force && p === 'whiteSpace') {
        const lineBreakExists = textNode.nodeValue.indexOf('\n') > -1;

        const whiteSpaceExists = lineBreakExists || /\s\s/.test(textNode.nodeValue);
        if (preserveWhiteSpace && whiteSpaceExists) {
          if (!enableLineWrapping) styleValue = 'pre';
          else styleValue = 'pre-wrap';
        } else if (preserveLineBreaks && lineBreakExists) {
          if (!enableLineWrapping) styleValue = 'pre'; // FIXME
          else styleValue = 'pre-line';
        }
      }
      parent.style[p] = styleValue;
    });
  }

  const range = document.createRange();

  function resize() {
    let textNodeRect = range.getBoundingClientRect();

    const textNodeRectOne = range.getClientRects()[0];

    const parentLineHeight = +parentStyle.getPropertyValue('line-height').replace(/px$/, '');

    const parentIndent = +parentStyle.getPropertyValue('text-indent').replace(/px$/, '');

    const parentIndentAdded = function parentIndentAdded() {
      return textNodeRect.height < 2 * parentLineHeight ? parentIndent : 0;
    };

    const originalTransform = parent.style.transform;

    parent.style.transform = 'none';
    range.selectNode(textNode);

    textNodeRect = realShape(range); // range.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    parent.style.transform = originalTransform;

    input.style.width = `${textNodeRect.width + 8 + parentIndentAdded()}px`;
    input.style.height = `${textNodeRect.height + 4}px`;
    input.style.bottom = `${parentRect.bottom - textNodeRect.bottom - 2}px`;
    input.style.left = `${textNodeRect.left - parentRect.left - 4 - parentIndentAdded()}px`;

    if (textNodeRectOne.left > textNodeRect.left && textNodeRect.height > textNodeRectOne.height) {
      input.style.textIndent = `${textNodeRectOne.left - textNodeRect.left}px`;
    }

    debug('resizing', input.style.width, input.style.height, input.style.bottom, input.style.left);
  }

  // adjust size of input
  selection.removeAllRanges();
  range.selectNode(textNode);
  resize();
  input.value = textNode.nodeValue;

  // input.value = $(e.currentTarget).contents()
  //   .filter(function() { return this.nodeType == Node.TEXT_NODE; }).first().text();

  function resizeForText(originalText = input.value) {
    let text = originalText;
    if (!text.trim()) text = (input.placeholder || '').trim();
    if (!textNode.tempValue) textNode.tempValue = textNode.nodeValue;
    if (text[text.length - 1] === '\n') text += ' ';
    textNode.nodeValue = text; // input.value;
    resize();
  }

  // input event handlers
  $(input).on('click', (/* inputClicked */) => false);

  $(input).on('focus', (e) => {
    const inputFocused = e;
    inputFocused.target.value = inputFocused.target.value;
  });

  $(input).on('keyup', (e) => {
    const inputKeyUp = e;
    if (inputKeyUp.keyCode === 8 || inputKeyUp.keyCode === 46) resizeForText();
  });

  $(input).on('keypress blur', (e) => {
    const inputSave = e;

    if (inputSave.type !== 'keypress' || (inputSave.which === 13 && !inputSave.shiftKey)) {
      if (typeof textNode.tempValue === 'undefined') textNode.tempValue = textNode.nodeValue;

      if (!textNode.originalValue && input.value !== textNode.tempValue) {
        textNode.originalValue = textNode.tempValue;

        // initialize an array of child text nodes
        if (!parent.childTextNodes) childTextNodes(parent);
        const resetButton = document.createElement('span');


        const stickButton = document.createElement('span');

        let saveButton;
        resetButton.className = 'reset';
        resetButton.title = 'Reset to original text';
        resetButton.innerHTML = '<i></i>';
        resetButton.textNode = textNode;

        if (makeChangesPermanent.call(textNode, { dryRun: true })) {
          saveButton = document.createElement('span');
          saveButton.className = 'save';
          saveButton.title = 'Save to database';
          saveButton.innerHTML = '<i></i>';
          saveButton.textNode = textNode;
          $(saveButton).on('click', _.bind(makeChangesPermanent, textNode));
        }
        stickButton.className = 'stick';
        stickButton.title = 'Stick this edit';
        stickButton.innerHTML = '<i></i>';
        stickButton.textNode = textNode;

        $(stickButton).on('click', (/* stickButtonClicked */) => {
          Meteor.call('createEdit', {
            path: window.location.pathname,
            selector: elementSelector(parent),
            index: textNode.textNodeIndex,
            original: textNode.originalValue,
            newValue: textNode.nodeValue,
          }, (stickError) => {
            if (stickError) {
              Log.error(stickError.reason);
              return;
            }
            applyEdits();
          });
        });
        textNode.adjustButtons = function adjustButtons() {
          const originalTransform = parent.style.transform;
          parent.style.transform = 'none';

          // const textNodeRect = range.getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();

          let button;
          let buttonIndex = 0;
          let buttonStyle;
          let buttonWidth;
          let buttonHeight;
          let buttonTextNode;
          // for (
          // var i = 0, button, buttonIndex = 0,
          //   buttonStyle, buttonWidth, buttonHeight, buttonTextNode;
          // button = parent.children[i++];
          // ) {
          Array.from(parent.children).forEach((child) => {
            button = child;

            if (button.tagName !== 'SPAN' || !/^(save|reset|stick)$/.test(button.className)) return;

            if (button.textNode !== buttonTextNode) {
              buttonIndex = 0;
              buttonTextNode = button.textNode;
            }

            range.selectNode(button.textNode);

            const textNodeRectOne = range.getClientRects()[0];

            if (!buttonStyle) buttonStyle = window.getComputedStyle(button);
            if (!buttonHeight) buttonHeight = +buttonStyle.getPropertyValue('height').replace(/px$/, '');
            if (!buttonWidth) buttonWidth = +buttonStyle.getPropertyValue('width').replace(/px$/, '');

            // button.style.left = (
            //   textNodeRectOne.left - parentRect.left - (0.4*buttonWidth)
            //   + (buttonIndex*(buttonWidth+2))
            //   ) + "px";
            // button.style.bottom = (parentRect.bottom - textNodeRectOne.top + 2) + "px";

            const angle = ((Math.PI / 4) * (2 * buttonIndex - 1));

            button.style.top = `${textNodeRectOne.top - parentRect.top + textNodeRectOne.height / 2 - buttonHeight / 2 - Math.cos(angle) * (textNodeRectOne.height + 7)}px`;
            button.style.left = `${textNodeRectOne.left - parentRect.left + textNodeRectOne.width / 2 - buttonWidth / 2 + Math.sin(angle) * (textNodeRectOne.height + 4)}px`;

            // button.style.transformOrigin =
            //   (textNodeRect.width/2)+"px "+(buttonHeight+2+textNodeRect.height/2)+"px";

            button.style.transform = `rotate(${angle}rad)`;

            buttonIndex += 1;
          });
          parent.style.transform = originalTransform;
        };

        textNode.removeButtons = function removeButtons() {
          nonObserved(() => {
            textNode.resetButton.remove();
            if (textNode.saveButton) textNode.saveButton.remove();
            if (textNode.stickButton) textNode.stickButton.remove();
          });
        };

        $(resetButton).on('click', (/* resetButtonClicked */) => {
          const selector = elementSelector(parent);


          const valueBeforeReset = textNode.nodeValue;
          Meteor.call('removeEdit', {
            path: window.location.pathname,
            selector,
            index: textNode.textNodeIndex,
          }, (removeEditError/* , removedEdit */) => {
            if (removeEditError) Log.error(removeEditError.reason);
            else debug('removed edit for selector', selector, ` text node #${textNode.textNodeIndex}`);
          });
          textNode.nodeValue = textNode.originalValue;
          delete textNode.originalValue;
          delete textNode.stuckValue;
          textNode.removeButtons();
          selection.removeAllRanges();
          let otherEditedNodes = false;
          // for (var i = 0, n; n = parent.childTextNodes[i++];) {
          Array.from(parent.childTextNodes).forEach((n) => {
            if (n.originalValue && n.adjustButtons) n.adjustButtons();
            if (n !== textNode && n.originalValue) otherEditedNodes = true;
          });

          if (parent.childTextNodes.length === 1 || !otherEditedNodes) {
            $(parent).removeClass('edited');
            resetParentStyle(true);
          }

          // fire our event for others to hook on (textNode reset) in event map :
          // 'editor:reset td': function(event, template, textNode, previousValue)
          $(parent).trigger('editor:reset', [textNode, valueBeforeReset]);
          return false;
        });

        const buttons = [resetButton];

        if (saveButton) buttons.push(saveButton);
        if (stickButton) buttons.push(stickButton);

        $(buttons).hover((hoverEvent) => {
          const hoverOn = hoverEvent;
          hoverOn.currentTarget.title.replace(/\s\(stuck\)$/, '');

          if (
            textNode.stuckValue
            && textNode.nodeValue === textNode.stuckValue
            && hoverOn.currentTarget.title.search(/\s\(stuck\)$/) === -1
          ) hoverOn.currentTarget.title += ' (stuck)';

          if (hoverOn.currentTarget.className === 'reset') $(parent).addClass('hl-red');
          if (hoverOn.currentTarget.className === 'stick') $(parent).addClass('hl-orange');
          if (hoverOn.currentTarget.className === 'save') $(parent).addClass('hl-green');

          range.selectNode(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }, (/* hoverOff */) => {
          $(parent).removeClass('hl-red hl-orange hl-green');
          selection.removeAllRanges();
        });

        $(parent).hover((/* hoverOn */) => {
          if (parentDisplay !== 'inline') return;
          parent.styleHover = {}; parent.styleHover.display = 'inline'; parent.style.display = 'inline-block';
        }, (/* hoverOff */) => {
          if (!parent.styleHover) return;
          // for (const p in parent.styleHover) parent.style[p] = parent.styleHover[p];
          Object.keys(parent.styleHover).forEach((p) => {
            parent.style[p] = parent.styleHover[p];
          });
        });

        nonObserved(() => {
          parent.appendChild(resetButton);
          textNode.resetButton = resetButton;
          if (saveButton) {
            parent.appendChild(saveButton);
            textNode.saveButton = saveButton;
          }
          if (stickButton) {
            parent.appendChild(stickButton);
            textNode.stickButton = stickButton;
          }
        });
        $(parent).addClass('edited');
        textNode.adjustButtons();
        // $(parent).prepend('<span class="reset" title="Reset to original text"><i></i></span>')
        //   .addClass('edited');
      }
      if (textNode.stickButton) {
        if (!textNode.stuckValue || textNode.stuckValue !== input.value) textNode.stickButton.style.visibility = 'visible';
        else textNode.stickButton.style.visibility = 'hidden';
      }

      if (input.value === textNode.originalValue) textNode.resetButton.click();
      else if (input.value !== textNode.tempValue) {
        textNode.makeChangesPermanent = _.bind(makeChangesPermanent, textNode);

        // for (var i = 0, n; n = parent.childTextNodes[i++];) {
        Array.from(parent.childTextNodes).forEach((n) => {
          if (n.originalValue && n.adjustButtons) n.adjustButtons();
        });

        // fire our event for others to hook on (textNode edited) in event map :
        // 'editor:edit td': function(event, template, textNode, previousValue)
        $(parent).trigger('editor:edit', [textNode, textNode.tempValue]);
      }
      delete textNode.tempValue;
    } else if (inputSave.keyCode !== 27) {
      if ((inputSave.which === 13 && !preserveWhiteSpace && !preserveLineBreaks)
          || (inputSave.which === 32 && !preserveWhiteSpace && input.value[input.selectionStart - 1] === ' ')) inputSave.preventDefault();
      else if (
        inputSave.which
        && (inputSave.which === 32
          || inputSave.which === 13
          || inputSave.charCode)
      ) {
        // eslint-disable-next-line no-bitwise
        let c = String.fromCharCode(inputSave.keyCode | inputSave.charCode);
        if (inputSave.which === 13) c = '\n';

        resizeForText(input.value.slice(0, input.selectionStart)
          + c + input.value.slice(input.selectionEnd));
      }
      return true;
    }

    // inputSave.stopImmediatePropagation();
    // inputSave.stopPropagation();
    // remove the input

    if (inputSave.keyCode === 27 && textNode.tempValue) textNode.nodeValue = textNode.tempValue;

    nonObserved(() => { input.remove(); });

    // reset style of parent
    resetParentStyle();

    // stop propagation
    return false;
  });

  nonObserved(() => {
    // remove other inputs
    const oldInput = document.getElementById('editable-input');
    if (oldInput) oldInput.remove();
    parent.appendChild(input).focus();
  });

  Meteor.defer(() => {
    input.selectionStart = 1000;
    input.selectionEnd = 10000;
  });
};

export default Inpladitor;
