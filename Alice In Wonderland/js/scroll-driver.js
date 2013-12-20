/**
 *
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
(function(){

  /*
    Position fixed an element to the viewport.
    @param {String} position Optional edge of the element to pin against: 'top', 'bottom'. Default 'top'
  */
  $.fn.pin = function(position){

    // check given position or use 'top' as default
    position = (['top', 'bottom'].indexOf(position) !== -1) ? position : 'top';

    function _pin(el){
      el.css({
        position: 'fixed',
        top: (position === 'top') ? 0 : 'auto',
        bottom: (position === 'bottom') ? 0 : 'auto',
        left: 0,
        zIndex: 1
      });
    }

    return $(this).each(function(){
      _pin($(this));
    });
  }

  /*
    Remove position fixed form an element. Reset coordinates and zIndex to auto
  */
  $.fn.unpin = function(){
    function _unpin(el){

      if (el.css('position') !== 'fixed')
        return;

      el.css({
        position: 'relative',
        top: 'auto',
        botton: 'auto',
        left: 'auto',
        zIndex: 'auto'
      })
    }

    return $(this).each(function(){
      _unpin($(this))
    })
  }

  /*
    jQuery utility wrapper for Array.some(). Polyfill if missing
  */
  $.some = function(obj, iterator, context) {
    var result = false

    if (obj == null){
      return result
    }

    if (Array.prototype.some && obj.some === Array.prototype.some){
      return obj.some(iterator, context)
    }

    $.each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return {};
    })

    return !!result;
  };


  /*
    Tween factory with decorated so its members handle the custom 'onReverseStart' event
  */
  var Tween = (function(){

    function _decorate(){
      var noop = function (){}
      var args = Array.prototype.slice.call(arguments, 0)
      var options = args[2]

      if (!options){
        return args
      }

      var _oldOnStart = options.onStart || noop,
          _oldOnUpdate = options.onUpdate || noop

      var decorated = $.extend(options, {
        onStart: function(){
          this._lastProgress = this.totalProgress()
          _oldOnStart.call(this)
        },

        onUpdate: function(){
          // the end was reached and going reverse
          if (this._lastProgress === 1 && this._lastProgress > this.totalProgress() && this.vars.data && this.vars.data.onReverseStart){
            this.vars.data.onReverseStart.call(this)
          }

          // memorize current progress for later
          this._lastProgress = this.totalProgress()

          _oldOnUpdate.call(this)
        }
      })

      args.splice(2, 1, decorated)

      return args
    }

    function constructor(){}

    constructor.prototype.to = function(){
      return TweenMax.to.apply(this, _decorate.apply(this, arguments))
    }

    constructor.prototype.from = function(){
      return TweenMax.from.apply(this, _decorate.apply(this, arguments))
    }

    return new constructor
  })()


  /*
    Timeline for scroll-driven animations. Wraps superscrollorama.

    Animations are described as TimelineLite or TweenMax instances.
    Animations are triggered and run with keyframe elements abs positioned on the timeline element.

    When a keyframe element's top edge reaches the top of the viewport,
    its associated animations are triggered. Animations run on scroll
    over the duration of the keyframe element's height in pixels.
  */
  var Timeline = (function(){

    // container for keyframe elements
    var _$timelineEl = $('#timeline')

    // keyframe index, auto-increment
    var _index = 0

    var _emWasDone = false

    // scroll controller
    var _controller = new $.superscrollorama({
      triggerAtCenter: false,
      playoutAnimations: false
    })

    /*
      Add a keyframe element to the timeline. It will be used as an element proxy for the scroll driver to trigger animations.

      All keyframes are absolutely positioned elements on a long, vertical timeline element.
      Vertical timeline approach used because there are vertical scroll and horizontal offsets to look at when triggering animations.

      @param {Object} options Hash with CSS properties to add.
      @example:
      {
        top: '100px',  // will trigger the animation when window.scrollY reaches 100px
        height: '200px' // will run the animation over a scroll of 200px after the trigger, scrollY from 100px to 300px
      }

      @return {Object} jQuery object reference to keyframe element.
    */
    var _addKeyframe = function(options){
      var id = 'key' + (++_index)
      var _defaults = {
            top: 0,
            height: '20px'
          }

      return $('<div>')
        .css($.extend({}, _defaults, options))
        .attr('id', id)
        .attr('class', function(){
          return options.navigable ? 'navigable': null
        })
        .appendTo(_$timelineEl)
    }

    return {
      /*
        Add a keyframe element and run an animation over the scroll distance equal to the keyframe's height.
        The animation is triggered when window.scrollY == the keyframe's top position.
        The animation runs on scroll over a distance equal to the keyframe's height

        @param {Object} keyframeCSS Hash of CSS properties to apply to the keyframe.

          @example:

          keyframeCSS = {
            top: 0, // start the animation when the window.scrollY is at 0 pixels
            height: '100px' // run the animation over a scroll distance of 100 pixels
          }

        @param {Object} animation Instance of TweenMax or TimelineLite
        @return {Object} the keyframe element
      */
      add: function(keyframeCSS, animation){
        var key = _addKeyframe(keyframeCSS)

        if (animation){
          _controller.addTween(key, animation, key.height())
        }

        return key
      },

      /*
        retro-transform all keyframe and spacer elements to 'em' units.
        TODO: use 'em' units when generating the elements
      */
      emALLTheThings: function(){
        // make sure we don't em-ize the em units.
        if (_emWasDone){
          return
        }

        var _fontSize = parseInt(window.getComputedStyle(document.body)['font-size'], 10)

        _$timelineEl.find('div').each(function(){
          var $key = $(this)
          $key.css({
            top: parseInt($key.css('top'), 10) / _fontSize + 'em',
            height: parseInt($key.css('height'), 10) / _fontSize + 'em'
          })
        })

        $('.pin-spacer').each(function(){
          $spacer = $(this)
          $spacer.css({
            height: parseInt($spacer.css('height'), 10) / _fontSize + 'em'
          })
        })

        _controller.triggerCheckAnim(true)
        _emWasDone = true
      },

      getKeyframes: function(){
        return _$timelineEl.find('div')
      }
    }

  })()

  var $scene1 = $('#scene1')
  var $scene2 = $('#scene2')
  var $scene3_1 = $('#scene3_1')
  var $scene3_2 = $('#scene3_2')

  /*
    Cross-fade between two scenes while scrolling:
      1. pin the source (from) element when its bottom edge reaches the bottom of the viewport
      2. fade to black overlay
      3. unpin the source element and pin the destination element (to) with its top edge stuck to the top of the viewport
      4. fade from black overlay
      5. unpin the destination element

    On reverse scroll, play the steps in reverse

    @param {Object} options Hash with configuration:

    options = {
      from: $('source'), // {Object} Source element
      to: $('destination'), // {Object} Destination element
      keyframe: null // @optional {Object} Keyframe element CSS properties instance over which to run the cross-fade. Default: starting at bottom of source element
    }
  */
  function crossfade(options){
    var $from = $(options.from)
    var $to = $(options.to)
    var $overlay = $('#overlay')

    var defaults = {
      keyframe: {
        top: $from.offset().top + $from.height() - window.innerHeight,
        height: window.innerHeight
      },

      // TODO extract default handlers and $.extend() if we get anything special
      handlers: [
        // fade-in handlers
        {

        },

        // fade-out handlers
        {

        }
      ]
    }

    var keyframe = $.extend({}, defaults.keyframe, options.keyframe)

    var $spacer = $('<div>')
      .attr('class', 'pin-spacer')
      .css({
        display: 'none',
        height: $from.height() + keyframe.height
      })
      .insertAfter($from)

    var animation = new TimelineLite()

    // fade-in
    animation.add(Tween.to($overlay, 1,
      {
        css: { autoAlpha: 1 },
        ease: Linear.easeNone,
        immediateRender: false,
        onStart: function(){
          if (options.onStart){
            options.onStart.call(this)
          }
          else{
            $from.pin('bottom')
          }

          $spacer.show()
        },
        data: {
          onReverseStart: function(){
            this.vars.onStart.call(this)
          }
        },
        onComplete: function(){
          if (options.onComplete){
            options.onComplete.call(this)
          }
          else{
            $from.unpin()
          }

          $spacer.hide()
        },
        onReverseComplete: function(){
          if (options.onReverseComplete){
            options.onReverseComplete.call(this)
          }
          else{
            $from.unpin()
          }
        }
      }))

    // fade-out
    animation.add(Tween.to($overlay, 1,
      {
        css: { autoAlpha: 0 },
        ease: Linear.easeNone,
        immediateRender: false,
        onStart: function(){
          $to.pin('top')
          $spacer.show()
        },
        data: {
          onReverseStart: function(){
            this.vars.onStart.call(this)
          }
        },
        onComplete: function(){
          $to.unpin()
          $spacer.hide()

          window.scrollTo(0, $to.offset().top)
        },
        onReverseComplete: function(){
          $to.unpin()
        }
      }))

    Timeline.add(keyframe, animation)
  }


  // --------------------- SCENE 1

  // Add a keyframe for the navigation to latch onto and drive to the start
  function setupStart(){
    var keyframe = {
      navigable: true,
      top: 0,
      height: 0
    }

    Timeline.add(keyframe)
  }

  function setupScene1(){

    // target element
    var $el = $('#scene1 p')

    // max amount by which to offset the margin-top
    var maxMargin = $el.height() + $scene1.height() - $el.height() - $el.offset().top

    // keyframe element CSS properties
    var keyframe = {
      top: $el.offset().top / 4,
      height: maxMargin
    }

    // animation description
    var animation = Tween.to($el, 1, {css: { marginTop: maxMargin }})

    // add an empty keyframe for the start of the demo
    // setupStart()

    Timeline.add(keyframe, animation)

    // setup crossfade to next scene when the bottom of $scene1 is reached
    crossfade({
      from: $scene1,
      to: $scene2,
      duration: window.innerHeight,
      keyframe: {
        navigable: true
      }
    })

  }

  // --------------------- SCENE 2

  function setupScene2(){

    // alice falling 1
    var $act1 = $('#scene2 .falling1')
    var animationAct1 = new TimelineLite()
    var keyframeAct1 = {
      // intentionally begin the animation before the parent scene is unpinned
      top: $act1.offset().top - window.innerHeight / 2,
      height: $act1.height()
    }

    animationAct1.add(Tween.from($act1, 0.25, {css: { autoAlpha: 0, transform:"translateY(-70px) rotate(-45deg) scale(0.85)" }}))
    animationAct1.add(Tween.to($act1, 0.75, {css: { autoAlpha: 1, transform:"translateY(70px) rotate(0deg) scale(0.85)" }}))
    animationAct1.defaultEasing = Linear.easeNone

    Timeline.add(keyframeAct1, animationAct1)

    // alice falling 2
    var $act2 = $('#scene2 .falling2')
    var animationAct2 = new TimelineLite()
    var keyframeAct2 = {
      top: $act2.offset().top - window.innerHeight / 2,
      height: $act2.height(),
    }

    animationAct2.add(Tween.from($act2, 0.25, {css: { autoAlpha: 0, transform:"translateY(-50px) rotate(-25deg) scale(0.85)" }}))
    animationAct2.add(Tween.to($act2, 0.25, {css: { autoAlpha: 0, transform:"translateY(50px) rotate(-25deg) scale(0.85)" }}))
    animationAct2.defaultEasing = Linear.easeNone

    Timeline.add(keyframeAct2, animationAct2)

    // alice seated on mushroom
    var $act3 = $('#scene2 .act1 .alice-shape')
    var animationAct3 = Tween.from($act3, 0.25, {css: { autoAlpha: 0 }})
    var keyframeAct3 = {
      top: $act3.offset().top - window.innerHeight / 2,
      height: $act3.height() * 1.5
    }

    Timeline.add(keyframeAct3, animationAct3)
  }

  function setupDialogueScene(){

    var $el = $scene2.find('.act2')
    var $deco = $scene2.find('.decoration')
    var viewportRest = window.innerHeight - $el.height()

    // amount by which to offset the scene horizontally to have the caterpillar act in the viewport
    var hOffset = Math.max(
      Math.abs( window.innerWidth - ($el.offset().left + $el.width()) ),
      $deco.offset().left
    )

    var keyframe = {
      top: $el.offset().top - viewportRest,
      height: $el.height() + hOffset + window.innerHeight // extent
    }

    var dialogueKeyframe = {
      top: keyframe.top + keyframe.height,
      height: window.innerHeight * 5 * 2  // run dialogue over 5 viewport height sizes, x2 for longer animations
    }

    var $spacer = $('<div>')
      .attr('class', 'pin-spacer')
      .css({
        height: keyframe.height + dialogueKeyframe.height
      })
      .insertAfter($scene2)

    // pin scene2 while dialogue animation is playing
    var pin = Tween.to($scene2, 0.2,
      {
        className: '+=pin',
        ease: Linear.easeNone,
        immediateRender: false,
        onStart: function(){
          if ($scene2.css('position') == 'fixed')
            return

          $scene2
            .pin()
            .css({
              top: -1 * $deco.height() + viewportRest + "px"
            })
        },
        data: {
          onReverseStart: function(){
            this.vars.onStart.call(this)
          }
        },
        onComplete: function(){
          // unpinning is done in the onComplete of the overlay fade-in (mid-point) to prevent flashes
        },
        onReverseComplete: function(){
          $scene2
            .unpin()
            .css({
              top: 'auto'
            })
        }
      })

    var animation = new TimelineLite()
    // horizontal offset
    animation.add(Tween.to( $scene2, 1,
      {
        css: { left: -1 * hOffset + 'px' },
        ease: Linear.easeNone,
        immediateRender: false
      }))

    // reveal caterpillar
    animation.add(Tween.to( $el, 1, { className:"+=day" }))

    var dialogueAnimation = getDialogueAnimation()

    // pin and animation added separately because we want them to run at the same time
    Timeline.add(keyframe, pin)
    Timeline.add($.extend({}, keyframe, { navigable: true }), animation)
    Timeline.add(dialogueKeyframe, dialogueAnimation)

    var pinToEnd = function (){
      if ($scene2.css('position') == 'fixed')
        return

      $scene2.pin()
        .css({
          left: -1 * hOffset + 'px',
          top: -1 * $deco.height() + viewportRest + "px"
        })
    }

    // cross-fade between caterpillar scene and cat falling scene
    crossfade({
      from: $scene2,
      to: $scene3_1,
      keyframe: {
        navigable: true,
        // queue the crossfade keyframe after the dialogue keyframe above
        top: dialogueKeyframe.top + dialogueKeyframe.height + window.innerHeight - viewportRest,
        height: window.innerHeight
      },
      onStart: pinToEnd,
      onReverseComplete: pinToEnd,
      onComplete: function(){
        $scene2
          .unpin()
          .css({
            top: 'auto'
          })
      }
    })
  }

  function setup(){
    // scene 1
    setupScene1()

    // scene 2
    setupScene2()
  
    // 'Luke, use the hammer'
    Timeline.emALLTheThings()

    // prevent from working in older Chrome
    if (window.navigator.userAgent.indexOf('Chrome') > -1 && !('onwheel' in window)){
      var html = document.documentElement;
      html.classList.remove('shape-inside')
      html.classList.add('no-shape-inside')
    }

    if (document.documentElement.classList.contains('shape-inside')){
      var delta = 0;
      var maxDelta = 50;
      var $el = $('#intro')

      function listener(e){ 
        e.preventDefault()
        delta += Math.abs(window.scrollY)

        if(delta > maxDelta){
          $el
            .addClass('hide')
            .on('transitionEnd webkitTransitionEnd', function(e){
              $el.remove()
            })

          window.removeEventListener('scroll', listener)
        }
      }

      // remove intro after a short scroll
      window.addEventListener('scroll', listener)
    }
    
    // generate navigation
    // nav()
  }

  // run setup on DOM ready
  $(setup)

  // feather-weight Modernizr-like CSS feature check
  $.each(['shape-inside','flow-into'], function(index, property){

    // check if any variant exists, prefixed or not
    var isCapable = $.some(['-webkit-','-ms-','-moz-',''], function(prefix){
      return prefix + property in document.body.style
    })

    property = isCapable ? property : 'no-' + property;

    document.documentElement.classList.add(property)
  })
  

})()
