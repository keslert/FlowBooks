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

	var imagePool = [];
	for(var i = 0; i < 2; i++) {
		var img = $('<img class="pool">');

		imagePool.push()
	}

	var debug = $('.debugger');
	function log(message) {
		debug.text(message);
	}

	function getImage(scene) {
		if(!imagePool.length) {
			imagePool.push('<img class="pool">')
		}

		return imagePool.unshift();
	}

	function clearImages(imgs) {
		for(var i = 0; i < imgs.length; i++) {
			var img = imgs[i];
			img.attr('src', '');
			img.removeClass();
			img.addClass('animate');
		}
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

	// Translate, Rotate, Scale
	function TRS(x, y, deg, scale) {
		return 'translate3d('+x+'px,'+y+'px,0px) rotate('+deg+'deg) scale3d('+scale+','+scale+',1)';
	}

	// Translate, Scale
	function TS(x, y, scale) {
		return 'translate3d('+x+'px,'+y+'px,0) scale3d('+scale+','+scale+',1)';	
	}

	// Tranlate
	function T(x, y) {
		return 'translate3d('+x+'px,'+y+'px,0)';
	}

	var isTouch = navigator.userAgent.match(/iPhone|iPad|iPod/i);
	var done = true;
	var scrollAmount = isTouch ? 10 : 20;
	var scrollListener = null;
	$(document).on("touchstart", function(e) {
		e.preventDefault();

		if(isTouch && e.originalEvent.touches && e.originalEvent.touches.length > 2) {
			location.reload();
		}
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
		if(e.which < 36 || e.which > 41)
			return;
		
		e.preventDefault();
		if(done) {
			done = false;
			scrollLoop(e.which == 37 ? 0 : 500);
		}
	}).keyup(function(e) {
		if(e.which < 36 || e.which > 41)
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
	var $i1 = $('#floating-image1');
	var $i2 = $('#floating-image2');
	var $i3 = $('#floating-image3');
	var $i4 = $('#floating-image4');

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
				$i1.attr('src', 'images/scene_3/red.png');
				$i2.attr('src', 'images/scene_3/wolf1.png');
				$i3.attr('src', 'images/scene_3/wolf2.png');
				$i4.attr('src', 'images/scene_3/wolf3.png');
			}
		})

		height += narrationKeyframe.height + wH;
	}

	function scene1_narrationAnimation() {
		// master timeline
		var anim = new TimelineLite();

		// part 1
		var text1 = 'Once upon a time there was a dear little girl who was loved by everyone who looked at her';
		var anim1 = new TimelineLite();
		anim1.add(Tween.to($t1, .1, { 
			delay: .1,
			css:{ opacity:0 },
			onStart: function() { 
				$t1.text(text1).css({ width:'35vw', transform:T(400, 20) });
				console.log('yammo 1');
			}
		}))
		anim1.add(Tween.to($t1, 1, { css:{ opacity:1, transform:T(400, 50) }, ease:Power1.easeInOut}))
		anim1.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text1) }} }))
		anim.add(anim1);

		var anim2 = new TimelineLite();
		var text2 = 'But most of all by her grandmother, and there was nothing that she would not have given to the child.';
		anim2.add(Tween.to($t1, .1, { 
			delay: .1,
			css:{ transform:T(400, 20) },
			onStart: function() { 
				$t1.text(text2) 
				console.log('yammo 2');
			}
		}))
		anim2.add(Tween.to($t1, 1, { css:{ opacity:1, transform:T(400, 50) }, ease:Power1.easeInOut}))
		anim2.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text2) }} }))
		anim.add(anim2);

		var anim3 = new TimelineLite();
		var text3 = 'Once she gave her a little riding hood of red velvet, which suited her so well that she would never wear anything else;';
		anim3.add(Tween.to($t1, .1, { 
			delay: .1,
			css:{ transform:T(400, 20) },
			onStart: function() { 
				$t1.text(text3);
				console.log('yammo 3');
			}
		}))
		anim3.add(Tween.to($t1, 1, { css:{ opacity:1, transform:T(400, 50) }, ease:Power1.easeInOut}))
		anim3.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.text(text3) }} }))
		anim.add(anim3);

		var anim4 = new TimelineLite();
		var text4 = 'so she was always called <span class="red bold">Little Red Riding Hood.</span>';
		anim4.add(Tween.to($t1, .1, { 
			delay: .1,
			css:{ transform:T(400, 20) },
			onStart: function() { 
				$t1.html(text4);
				console.log('yammo 4');
			}
		}))
		anim4.add(Tween.to($t1, 1, { css:{ opacity:1, transform:T(400, 50) }, ease:Power1.easeInOut}))
		anim4.add(Tween.to($t1, 1, { css:{ opacity:0}, data: { onReverseStart: function() { $t1.html(text4).css({ width:'35vw' }) }} }))
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

		var $spacer = $('<div>')
			.attr('class', 'pin-spacer')
			.css({
				height: narrationKeyframe.height
			})
			.insertAfter($scene2)

		var scrollAnimation = new TimelineLite();
		scrollAnimation.add(Tween.to($b1, 1,
			{
				css: { transform:T(-800, 0)},
				ease: Linear.easeNone,
				immediateRender: false,
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

		Timeline.add(redKeyframe, scene2_narrationAnimation());
		Timeline.add(redKeyframe, scene2_redAnimation());

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
		// master timeline
		var anim = new TimelineLite()


		function animate(text, i) {
			var anim1 = new TimelineLite();
			anim1.add(Tween.to($t1, .1, {
				delay: (i == 0 || i == 3) ? 1 : 0,
				css:{ opacity:0, transform:T(-400, 200) },
				onStart: function() {
					console.log(text);
					$t1.text(text).css({ width:'80vw' })
				},
			}))
			anim1.add(Tween.to($t1, 1, { css:{ opacity:1, transform:T(100, 200) }, ease:Power1.easeInOut}))
			anim1.add(Tween.to($t1, 1, { css:{ transform:T(150, 200) }}))
			anim1.add(Tween.to($t1, 1, { css:{ opacity:0, transform:T(600, 200) }, data: { onReverseStart: function() { $t1.text(text) }} }))
			anim.add(anim1);
		}

		var text1 = 'The grandmother lived out in the wood';
		var text2 = 'half a league from the village';
		var text3 = 'and just as Little Red Riding Hood entered the wood,';
		var text4 = 'a Wolf met her.';
		var text = [text1, text2, text3, text4];
		for(var i = 0; i < text.length; i++) {
			animate(text[i], i);
		}

		return anim;
	}

	function scene2_redAnimation() {

		// master timeline
		var anim = new TimelineLite()


		var $red = $i1;
		var $wolf1 = $i2;
		var $wolf2 = $i3;
		var $wolf3 = $i4;

		var redScale = .35;

		var anim1 = new TimelineLite();
		anim1.add(Tween.to($red, .1, {
			onStart: function() { 
				console.log('RED 1');
				$red.addClass('scene2 red').css({ opacity:0, transform:TRS(0, 13, 0, redScale)});
			}, 
			onReverseComplete: function(){
				console.log('RED 2');
				clearImages([$red, $wolf1, $wolf2, $wolf3]);
			},
		}));
		anim1.add(Tween.to($red, .1, {ease: Linear.easeNone, css:{ transform:TRS(-10, 13, 0, redScale) }}))
			anim1.add(Tween.to($wolf1, .1, {delay:-.1, ease: Linear.easeNone, css:{ transform:TRS(110, 130, 0, .3) } }));
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ autoAlpha:1, transform:TRS(-80, 13, 0, redScale)}}))
			anim1.add(Tween.to($wolf1, 1, {delay:-1, ease: Linear.easeNone, css:{ transform:TRS(30, 130, 0, .3), opacity:1 } }));


		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-150, 13, 0, redScale) }}))
		anim1.add(Tween.to($wolf1, 1, {delay:-1, ease: Linear.easeNone, css:{ transform:TRS(-50, 130, 0, .3), opacity:0 } }));
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-220, 13, 0, redScale), autoAlpha:0 }}))
		anim1.add(Tween.to($red, .1, {ease: Linear.easeNone, css:{ transform:TRS(10, 13, 0, redScale) }}))
			anim1.add(Tween.to($wolf2, .1, {delay:-.1, ease: Linear.easeNone, css:{ transform:TRS(210, 220, 0, .3) }}));
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-60, 13, 0, redScale), autoAlpha:1 }}))

	
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-130, 13, 0, redScale) }}))
			anim1.add(Tween.to($wolf2, 1, {delay:-1, ease: Linear.easeNone, css:{ transform:TRS(130, 220, 0, .3), opacity:1 } }));
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-200, 13, 0, redScale), autoAlpha:0 }}))
			anim1.add(Tween.to($wolf2, 1, {delay:-1, ease: Linear.easeNone, css:{ transform:TRS(50, 220, 0, .3), opacity:0 } }));
		anim1.add(Tween.to($red, .1, {ease: Linear.easeNone, css:{ transform:TRS(20, 13, 0, redScale) }}))
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-50, 13, 0, redScale), autoAlpha:1 }}))


		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-120, 13, 0, redScale) }}))
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-190, 13, 0, redScale), autoAlpha:0 }}))
		anim1.add(Tween.to($red, .1, {ease: Linear.easeNone, css:{ transform:TRS(30, 13, 0, redScale)}}))
			anim1.add(Tween.to($wolf3, .1, {delay:-.1, ease: Linear.easeNone, css:{ transform:TRS(310, 80, 0, .6) }}));
		anim1.add(Tween.to($red, 1, {ease: Linear.easeNone, css:{ transform:TRS(-40, 13, 0, redScale), autoAlpha:1 }}))
			anim1.add(Tween.to($wolf3, 1, {delay:-1, ease: Linear.easeNone, css:{ transform:TRS(230, 80, 0, .6), opacity:1 } }));
		// anim1.add(Tween.to($wolf3, 1, {delay:-1, css:{ autoAlpha:1 }}))

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
