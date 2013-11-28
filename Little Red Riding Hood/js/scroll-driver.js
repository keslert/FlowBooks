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


	var debug = $('.debugger');
	function log(message) {
		debug.text(message);
	}

	function screenX(e) {
		return e.originalEvent.changedTouches[0].screenX;	
	}

	function scrollLoop(x) {
		window.scrollBy(0, x > 400 ? scrollAmount : -scrollAmount);
		log(Math.random());

		if(!done) {
			window.requestAnimationFrame(function() {
				scrollLoop(x)
			});
		}
	}

	var done = true;
	var scrollAmount = navigator.userAgent.match(/iPhone|iPad|iPod/i) ? 8 : 20;
	var scrollListener = null;
	$(document).on("touchstart", function(e) {
		e.preventDefault();
		var x = screenX(e);

		if(done) {
			done = false;
			scrollLoop(x);
		}
	}).on("touchmove", function(e) {
		e.preventDefault();
	}).on("touchend", function(e) {
		e.preventDefault();
		done = true;
	});

	$(document).keydown(function(e) {
		if(e.which < 36 && e.which > 41)
			return;
		
		e.preventDefault();
		if(done) {
			done = false;
			scrollLoop(e.which == 37 ? 0 : 500);
		}
	}).keyup(function(e) {
		if(e.which < 36 && e.which > 41)
			return;
		e.preventDefault();
		done = true;
	})

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
					if (this._lastProgress === 1 && this._lastProgress > this.totalProgress() && this.vars.data && this.vars.data.onReverseStart) {
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
				top: '100px',	// will trigger the animation when window.scrollY reaches 100px
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
	var $scene3 = $('#scene3')

	var $t1 = $('#floating-text');
	var $i1 = $('#floating-image');

	var $b1 = $('#background_1');
	var $b2 = $('#background_2');

	var wH = window.innerHeight

	var backgrounds = [
		{
			css: { top: 20, width:'125vw' },
			image: 'images/scene_1/scene_1.jpg'
		},{
			css: { top: 20, width:'200vw' },
			image: 'images/scene_3/forest.jpg'
		}
	]

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
			}
		}

		var keyframe = $.extend({}, defaults.keyframe, options.keyframe)

		var $spacer = $('<div>')
			.attr('class', 'pin-spacer')
			.css({
				// display: 'none',
				// height: $from.height() + keyframe.height
				height: keyframe.height
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
				},
				onReverseComplete: function(){
					// if (options.onReverseComplete){
					// 	options.onReverseComplete.call(this)
					// }
				}
			}
		))

		// fade-out
		animation.add(Tween.to($overlay, 1,
			{
				css: { autoAlpha: 0 },
				ease: Linear.easeNone,
				immediateRender: false,
				onStart: function(){
					// $to.pin('top')
					// $spacer.show()
				},
				data: {
					onReverseStart: function(){
						this.vars.onStart.call(this)
					}
				},
				onComplete: function(){
					// $to.unpin()
					// $spacer.hide()

					// window.scrollTo(0, $to.offset().top)
				},
				onReverseComplete: function(){
					if (options.onReverseComplete){
						options.onReverseComplete.call(this)
					}
				}
			}))

		Timeline.add(keyframe, animation)
	}


	// --------------------- SCENE 1

	var height = 0;

	// Add a keyframe for the navigation to latch onto and drive to the start
	function setupStart(){
		var keyframe = {
			navigable: true,
			top: 0,
			height: 0
		}

		Timeline.add(keyframe)
	}

	function setupScene1() {
		var keyframe = { top:0, height:1 }
		var animation = Tween.to($b1, 1, {css: backgrounds[0].css });
		Timeline.add(keyframe, animation);

		// add an empty keyframe for the start of the demo
		setupStart()

		var narrationKeyframe = {
			top: height,
			height: window.innerHeight * 4
		}

		var $spacer = $('<div>')
			.attr('class', 'pin-spacer')
			.css({
				height: narrationKeyframe.height
			})
			.insertAfter($scene1)

		var narrationAnimation = scene1_narrationAnimation();

		Timeline.add(narrationKeyframe, narrationAnimation);
		
		// setup crossfade to next scene when the bottom of $background is reached
		crossfade({
			from: $scene1,
			to: $scene2,
			duration: wH,
			keyframe: {
				navigable: true,
				top: narrationKeyframe.top + narrationKeyframe.height,
				height: wH
			},
			onReverseComplete: function() {
				$b1.attr('src', backgrounds[0].image);
				$b1.css(backgrounds[0].css);
			},
			onComplete: function(){
				$b1.attr('src', backgrounds[1].image);
				$b1.css(backgrounds[1].css);
			}
		})

		height += narrationKeyframe.height + wH;
	}

	function scene1_narrationAnimation() {
		$t1.css({
			width:'35vw',
			left:'30vw',
			top:'10vw'
		})
		// master timeline
		var anim = new TimelineLite()

		// part 1
		var text1 = 'Once upon a time there was a dear little girl who was loved by everyone who looked at her';
		var anim1 = new TimelineLite();
		anim1.add(Tween.to($t1, 0, { 
			css:{ opacity:0, transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.text(text1) },
		}))
		anim1.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim1.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text1) }} }))
		anim.add(anim1);

		var anim2 = new TimelineLite();
		var text2 = 'But most of all by her grandmother, and there was nothing that she would not have given to the child.';
		anim2.add(Tween.to($t1, .1, { 
			delay: .1,
			css:{ transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.text(text2) }
		}))
		anim2.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim2.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text2) }} }))
		anim.add(anim2);

		var anim3 = new TimelineLite();
		var text3 = 'Once she gave her a little riding hood of red velvet, which suited her so well that she would never wear anything else;';
		anim3.add(Tween.to($t1, .1, { 
			delay: .1,
			css:{ transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.text(text3) }
		}))
		anim3.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim3.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text3) }} }))
		anim.add(anim3);

		var anim4 = new TimelineLite();
		var text4 = 'so she was always called <span class="red bold">Little Red Riding Hood.</span>';
		anim4.add(Tween.to($t1, .1, { 
			delay: .1,
			css:{ transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.html(text4) }
		}))
		anim4.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim4.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.html(text4) }} }))
		anim.add(anim4);

		return anim;
	}

	// --------------------- SCENE 2
	function setupScene2() {
		var pause = 30;
		var narrationKeyframe = {
			top: height,
			height: wH * 5
		}

		var backgroundKeyframe = {
			top:height,
			height: narrationKeyframe.height
		}

		var $spacer = $('<div>')
			.attr('class', 'pin-spacer')
			.css({
				height: narrationKeyframe.height
			})
			.insertAfter($scene2)

		var narrationAnimation = scene2_narrationAnimation();

		var scrollAnimation = new TimelineLite();
		scrollAnimation.add(Tween.to($scene2, 1,
			{
				css: { transform:'translate3d(-800px, 0, 0)'},
				ease: Linear.easeNone,
				immediateRender: false
			}
		))

		var scrollKeyframe = {
			top:height + pause,
			height: narrationKeyframe.height
		}

		var redKeyframe = {
			top: height + pause,
			height: narrationKeyframe.height
		}
		var redAnimation = scene2_redAnimation();

		Timeline.add(redKeyframe, redAnimation);
		// Timeline.add(narrationKeyframe, narrationAnimation);
		Timeline.add(scrollKeyframe, scrollAnimation);

		// setup crossfade to next scene when the bottom of $scene1 is reached
		crossfade({
			from: $scene2,
			to: $scene3,
			duration: window.innerHeight,
			keyframe: {
				navigable: true,
				top: narrationKeyframe.top + narrationKeyframe.height + wH,
				height: window.innerHeight
			},
			onReverseComplete: function() {

			},
			onComplete: function(){
				
			}
		})
		height += narrationKeyframe.height + wH;
	}

	function scene2_narrationAnimation() {
		$t1.css({
			width:'35vw',
			left:'30vw',
			top:'10vw'
		})
		// master timeline
		var anim = new TimelineLite()

		// part 1
		var text1 = 'The grandmother lived out in the wood';
		var anim1 = new TimelineLite();
		anim1.add(Tween.to($t1, 0, { 
			css:{ opacity:0, transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.text(text1) },
		}))
		anim1.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim1.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text1) }} }))
		anim.add(anim1);

		var text2 = 'half a league from the village';
		var anim2 = new TimelineLite();
		anim2.add(Tween.to($t1, 0, { 
			css:{ opacity:0, transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.text(text2) },
		}))
		anim2.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim2.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text2) }} }))
		anim.add(anim2);

		var text3 = 'and just as Little Red Riding Hood entered the wood,';
		var anim3 = new TimelineLite();
		anim3.add(Tween.to($t1, 0, { 
			css:{ opacity:0, transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.text(text3) },
		}))
		anim3.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim3.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text3) }} }))
		anim.add(anim3);

		var text4 = 'a Wolf met her.';
		var anim4 = new TimelineLite();
		anim4.add(Tween.to($t1, 0, { 
			css:{ opacity:0, transform:'translate3d(30px, 20px, 0)' },
			onStart: function() { $t1.text(text4) },
		}))
		anim4.add(Tween.to($t1, 1, { css:{ opacity:1, transform:'translate3d(30px, 50px, 0)' }, ease:Power1.easeInOut}))
		anim4.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text4) }} }))
		anim.add(anim4);

		return anim;
	}

	function scene2_redAnimation() {

		// master timeline
		var anim = new TimelineLite()

		var $red = $('#scene2 .red').attr('src', 'images/scene_3/red.png');
		var $wolf = $('#scene2 .wolf');

		var anim1 = new TimelineLite();
		anim1.add(Tween.to($red, 1, {delay: 1, css:{ autoAlpha:0 }}))
		anim1.add(Tween.to($red, .1, {delay: 0, css:{ transform:"translate3d(350px, 0, 0) rotate(3deg)" }}))
		anim1.add(Tween.to($red, 1, {delay: 0, css:{ autoAlpha:1 }}))
		

		// anim1.add(Tween.to($wolf1, 1, {delay:-2.0, css:{ autoAlpha:1 }}))

		anim1.add(Tween.to($red, 1, {delay: 1, css:{ autoAlpha:0 }}))
		anim1.add(Tween.to($red, .1, {delay: 0, css:{ transform:"translate3d(700px, 0, 0) rotate(-3deg)" }}))
		anim1.add(Tween.to($red, 1, {delay: 0, css:{ autoAlpha:1 }}))
		// anim1.add(Tween.to($wolf1, .5, {delay:-2.0, css:{ autoAlpha:0 }}))
		// anim1.add(Tween.to($wolf2, 2, {delay:-1.5, css:{ autoAlpha:1 }}))

		anim1.add(Tween.to($red, 1, {delay: 1, css:{ autoAlpha:0 }}))
		anim1.add(Tween.to($red, .1, {delay: 0, css:{ transform:"translateX(1050px) rotate(3deg)" }}))
		anim1.add(Tween.to($red, 1, {delay: 0, css:{ autoAlpha:1 }}))
		// anim1.add(Tween.to($wolf2, 1, {delay:-1.25, css:{ autoAlpha:0 }}))

		anim1.add(Tween.to($red, 1, {delay: 1, css:{ autoAlpha:0 }}))
		anim1.add(Tween.to($red, .1, {delay: 0, css:{ transform:"translateX(1300px) rotate(0deg)" }}))
		anim1.add(Tween.to($red, 1, {delay: 0, css:{ autoAlpha:1 }}))
		// anim1.add(Tween.to($wolf3, 1, {delay:-1, css:{ autoAlpha:1 }}))

		anim1.add(Tween.to($red, 1, {delay: 1, css:{ autoAlpha:1 }}))
		anim1.add(Tween.to($red, .1, {delay: 0, css:{ transform:"translateX(1300px) rotate(0deg)" }}))
		anim1.add(Tween.to($red, 1, {delay: 0, css:{ autoAlpha:1 }}))



		anim.add(anim1);

		return anim;
	}

	function trans(options){
		var $overlay = $('#overlay')
		var noop = function(){}
		var defaults = {
			duration: 2, // seconds
			onStart: noop,
			onHalfway: noop,
			onComplete: noop
		}
		var config = $.extend({}, defaults, options)
		var animation = new TimelineLite()
		// animation.defaultEasing = Power4.easeOut

		// fade-in
		animation.add(Tween.to($overlay, config.duration / 2,
			{
				ease: Linear.easeIn,
				css: { autoAlpha: 1 },
				onStart: config.onStart
			}
		))

		// fade-out
		animation.add(Tween.to($overlay, config.duration / 2,
			{
				ease: Cubic.easeOut,
				css: { autoAlpha: 0 },
				onStart: config.onHalfway,
				onComplete: config.onComplete
			}
		))

		animation.play()
	}

	function nav(){

		var $navEl = $('nav')
		var frag = document.createDocumentFragment()

		// get only keyframes that make sense for navigation; ignore helpers
		var keys = Timeline.getKeyframes().filter('.navigable')

		$navEl.delegate('a', 'click', function(e){
			e.preventDefault()

			var $key = $($(e.target).attr('href'))
			var maxY = $key.offset().top + $key.height()
			var currY = window.scrollY
			var speed = 300 // px/second
			var delta = maxY - window.scrollY
			var distance = Math.abs(maxY - currY)
			var maxDuration = 3 // seconds
			var duration = distance / speed

			// large distance to travel; teleport there
			if (duration > maxDuration){
				trans({
					onHalfway: function(){ window.scrollTo(0, maxY) }
				})
			}
			else{
				TweenMax.to(window, duration, {scrollTo:{y : maxY}, ease:Power2.easeOut});
			}
		})

		// TODO: add a start keyframe in Timeline to be able to go back to top
		$.each(keys, function(index, key){
			frag.appendChild(
				$('<a>').attr({
					href: '#' + key.id
				})[0])
		})

		$navEl.append(frag)
	}

	function setup(){
		// scene 1
		setupScene1();

		// scene 2
		setupScene2();

		// 'Luke, use the hammer'
		Timeline.emALLTheThings()

		// prevent from working in older Chrome
		if (window.navigator.userAgent.indexOf('Chrome') > -1 && !('onwheel' in window)){
			var html = document.documentElement;
			html.classList.remove('shape-inside')
			html.classList.add('no-shape-inside')
		}

		if (document.documentElement.classList.contains('shape-inside')){
			var $el = $('#intro')

			function listener(e){ 
				e.preventDefault()

				$el.addClass('hide').on('transitionEnd webkitTransitionEnd', function(e){
					$el.remove()
				})

				window.removeEventListener('scroll', listener)
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
