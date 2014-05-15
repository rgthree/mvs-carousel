/**
 * *Exports the Carousel View*, as well as a helper Carousel.Nav view. The Nav view can be instantiated
 * automatically by the carousel, or alone and manually listened for.
 *
 * @module Carousel
 */
;(function(){

  "use strict";

  var Carousel = this.Carousel = new Class(/** @lends module:Carousel.Carousel.prototype */{
    Implements: [Events, Options],

    /**
     * @property {Object} options
     * @memberof! module:Carousel.Carousel#
     * 
     * @property {Number}                [options.delay=5000]                  Delay in ms before moving the slide. Passing 0, null or any non-number will not use a timer.
     * @property {Boolean}               [options.nav=true]                    Automatically create a Carousel.Nav menu and append it after the list
     * @property {Boolean}               [options.loop=true]                   Whether or not to loop to the beginning when we hit the last item on the timer
     * @property {Null|String|Number}    [options.slide-size=null]             The size of the slide. Can be null, an integer, or a string-percentage.
     *                                                                         Most likely will be left null, which will allow the Carousel to automatically calculate the slides widths,
     *                                                                         But can be overridden with hardcoded values if desired.
     * @property {String}                [options.slide-alignment=center]      The alignment of the slide when it is less than 100% of the width. Essentially, calculates the slide width and
     *                                                                         disperses the remainder between the left and/or right sides.
     * @property {String}                [options.slide-ends-alignment=sticky] Can be 'sticky' or 'aligned'. Controls whether an ending slide (initial or last) slide should stick to the edge,
     *                                                                         or align itself to the alignment.
     * @property {String}                [options.slide-mode=multiple]         Can be 'multiple' or 'single'
     *                                                                         This is only used when `options.slide-size = null`:
     *                                                                         "multiple": Size of the slide should dictate by as many children fit wholly in the container (could be just one)
     *                                                                         "single": Each child is a slide, styled to be the same width
     *                                                                         "single-flex": Each child is a slide, but their widths are inconsistent
     */
    options: {
      delay: 5000,
      nav: true,
      loop: true,
      'slide-size': null,
      'slide-alignment': 'center',
      'slide-ends-alignment':'sticky',
      'slide-mode': 'multiple',
      'transform-property': window.Modernizr && Modernizr.prefixed ? Modernizr.prefixed('transform') : 'transform'
    },

    events: {
      
    },

    /**
     * Carousel takes a ul element and adopts it as the view's. If none is passed, it will create a shell of one.
     * The Carousel works simply by _scrolling_ iself the width of the ul. A "slide" in the carousel is simply a 
     * section of it's view that is scrolled to, not necessarily tied to it's children.
     *
     * Carousel has a bunch of options that allow it to be used in many versatil situations:
     * 
     *  - `options.slide-mode = 'multiple'`    The default option, this will allow the carousel to calculate the offsets of each
     *                                         "slide" by determining the number of children that fit within the stage. It does this
     *                                         upfront and caches it, so each slide should contain the same amount of children styled
     *                                         identically. If there is a remainder of stage size available, it is distributed
     *                                         between the left and right sides dependant on the `slide-alignment` option.
     *  - `options.slide-mode = 'single'`      Here, each child is a slide, and is calulcated upfront and cached, so each child
     *                                         should be styled with the same width. If there is a remainder when subtracting the 
     *                                         child width with the stage width, it is distributed it between the left and right
     *                                         sides dependant on the `slide-alignment` option.
     *  - `options.slide-mode = 'single-flex'` Here, each child is a slide, but the calculations are done on a move command and are, therefore,
     *                                         more expensive. This is useful when the items's sizes may not be uniform. If there is a remainder
     *                                         when subtracting the current child width from the stage width, it is distributed it between
     *                                         the left and right sides dependant on the `slide-alignment` option.
     *  - `options.slide-size = <not null>`    When slide-size is an integer (for pixels), or a string percentage (or the stage-width) the carousel
     *                                         will use that for the width of each slide and completely disconnect from the children within.
     *                                         When specified, `slide-mode` is ignored. This is the
     *                                         most efficient, yet most advanced.
     * 
     * Carousel also works with touch devices determining if the user is "swiping" within in, from left or right. In order
     * for a more native feel, the carousel's CSS adds an resistance width of 50 using :before & :after pseudo elements. These 50x
     * on either side are used to add elasticity/resistence when the user touches and drags at the end. This is compensated
     * within the math when determining movement, size, and position.
     * 
     * @constructs Carousel
     * @memberof! module:Carousel
     * @param {Element} [element] The list element to carousel-ize
     * @param {Object}  [options] The options for the view, defined above
     */
    initialize: function(element, options){
      var self, hasTouch;
      self = this;
      self.setOptions(options);

      self.element = (element || new Element('ul')).set('id', String.uniqueID()).addClass('carousel-view').store('carousel', self);

      self.onWindowResize = self.onWindowResize.bind(self);
      self.onTouchStart = self.onTouchStart.bind(self);
      self.onNavChoose = self.onNavChoose.bind(self);
      window.addEvent('resize', self.onWindowResize);

      // Check for touch support & add the event to our maps
      if((hasTouch = !!('ontouchstart' in window || window.DocumentTouch && document instanceof DocumentTouch)))
        self.element.addEvent('touchstart', self.onTouchStart);
      self.element.addClass('-has-touch-'+hasTouch);

      // Automatically instantiate the nav
      if(self.options.nav === true){
        self.nav = new Carousel.Nav();
        if(self.element.getParent())
          $(self.nav).inject(self.element, 'after');
        // Add the onNavChoose to our events map
        self.nav.addEvent('choose', self.onNavChoose);
      }

      // Since w're not a view, we'll make a mock model
      self.model = new MooVeeStar.Model({ 'current-slide':0 });
      
      // Delay our delay in case we're not yet attached to the DOM
      (function(){
        self.calculate().start().move(0);
      }).delay(1);
      
    },

    /**
     * Starts the carousel's timer loop
     *
     * @memberof! module:Carousel.Carousel#
     */
    start: function(){
      var self = this;
      self.stop();
      if(typeof(self.options.delay) === 'number' && self.options.delay > 0)
        self.timer = self.move.periodical(self.options.delay, self, [1, { event:'timer' }])
      return self;
    },

    /**
     * Stops the carousel's timer loop
     *
     * @memberof! module:Carousel.Carousel#
     */
    stop: function(){
      var self = this;
      self.timer && clearInterval(self.timer);
      delete self.timer;
      return self;
    },

    /**
     * We were trying to use ScrollSize. Unfortunately, Webkit returns the value we want, the entire scrollsize,
     * but gecko/firefox returns the scrollsize minus the negative left-transform offset. We need to move the 
     * items before calculating. We want to stick with scrollsize (rather than calculating all the children's widths)
     * since that will be correct if the children have spacing/positining/etc. applied.
     *
     * @return {Number} The total size of the inner width
     */
    getTotalSize: function(){
      var self, current, size;
      self = this;
      current = self.getCurrentOffset(true);
      self.element.addClass('-adjusting');
      self._move(0);
      size = self.element.getScrollSize().x;
      self._move(current);
      self.element.removeClass('-adjusting');
      return size;
    },

    /**
     * Calculates dimensions and additional data.
     * If there's a nav item, update it's slides
     *
     * @memberof! module:Carousel.Carousel#
     */
    calculate: function(){
      var self, size, slideSize, totalSize, slideOffsetLeft, slideOffsetRight, children, childSize, index, slides;
      self = this;
      size = self.element.getSize().x;
      totalSize = self.getTotalSize();

      // If our slide-size is null, then we're in automatic mode.
      if(self.options['slide-size'] === null){
        children = self.element.getChildren();
        if(!children[0]){
          slideSize = '100%';

        }else if(self.options['slide-mode'] === 'single'){
          slideSize = children[0].getSize().x;

        }else{
          // The default, of multi (this will also work as 'single' if each slide is greater than 50% of the width)
          // Assume our slide size is the width of the stage subtracted by the remainder from the last fully visible child
          // Unforatunately, we need to oop over children, not just modulo the first child's width since there
          // could be percentage rounding by the browser CSS
          slideSize = childSize = index = 0;
          do{
            slideSize += childSize;
            childSize = children[index].getSize().x;
            index++;
          }while(slideSize + childSize <= size && children[index]);
          // If there is no next child and out slideSize is less than the totalSize, then let's
          // force into a single slide
          if(!children[index] && slideSize < totalSize)
            slideSize = "100%";
        }
      }else{
        slideSize = self.options['slide-size'] || size;
      }

      if(String(slideSize).contains('%'))
        slideSize = size * (parseInt(slideSize, 10)/100);

      slideOffsetLeft = slideOffsetRight = (size-slideSize)/2;
      if(self.options['slide-alignment'] === 'left'){
        slideOffsetLeft = 0;
        slideOffsetRight = slideOffsetRight*2;
      }else if(self.options['slide-alignment'] === 'right'){
        slideOffsetLeft = slideOffsetLeft*2;
        slideOffsetRight = 0;
      }

      slides = self.options['slide-size'] === null && self.options['slide-mode'].contains('single') ? self.element.getChildren().length : Math.ceil(totalSize / slideSize);
      if(slideSize === 0 || slides === 0)
        slides = 1;

      self.model.set({
        'stage-size': size,
        'total-size': totalSize,
        'slide-offset-left': slideOffsetLeft,
        'slide-offset-right': slideOffsetRight,
        'slides':    slides
      });
      
      if(self.nav)
        self.nav.update(self.model.get('slides'));

      self.element.set('data-slides', self.model.get('slides'));

      return self;
    },

    /**
     * Gets the current offset of the carousel, not taking into consideration the animation
     *
     * @param {Boolean} [raw=false] If true, then get the raw offset value. For isntance, if we're touching, our offset is not
     *                              recorded in `this.currentOffset` so we want to get the raw value.
     */
    getCurrentOffset: function(raw){
      if(raw){
        var first = this.element.getFirst();
        return first && Number((first.getStyle(this.options['transform-property']) || '').replace(/^.*?translateX\(([\-\d\.]+).*?$/gi, '$1')) || this.currentOffset || 0;
      } 
      return this.currentOffset || 0;
    },

    /**
     * Get the current computed position of the transform
     */
    getComputedOffset: function(){
      var cssMatrix, matrix, x, y;
      cssMatrix = getComputedStyle(this.element.getFirst(), null)[this.options['transform-property']];
      matrix = cssMatrix.replace(/[^0-9\-.,]/g, '').split(',');
      x = parseInt((cssMatrix.indexOf("matrix3d") == 0 ? matrix[12] * 1 : matrix[4] * 1), 10);
      //y = parseInt((cssMatrix.indexOf("matrix3d") == 0 ? matrix[13] * 1 : matrix[5] * 1), 10);
      return x;
    },

    /**
     * This "fixes" the carousel if it gets into a state where something has changed.
     * For instance, this is called from a window resize where the current scroll position may
     * be incorrect
     *
     * @memberof! module:Carousel.Carousel#
     */
    fix: function(){
      var self;
      self = this;
      self.calculate().move(0);
      return self;
    },

    /**
     * Moves the carousel a number of slides from it's current.
     * It will never go less than the first, but it will loop endlessly
     * forward (from last back to first) if it's from the timer. Otherwise,
     * like if from a touch event, it will stop at the last,
     *
     * @memberof! module:Carousel.Carousel#
     * @param {Number} direction A positive/negative number of slide indices to move
     * @param {Object} [opts] Options such as transition, and event type
     * @param {Function} [callback] A callback tofire after the scroll fx finishes
     */
    move: function(direction, opts, callback){
      var self, target, fxOptions, thisSlide, thisSlideChild, cancel;
      self = this;
      if(self._moving === true){
        callback && callback();
        return self;
      }
      self._moving = true;
      opts = opts || {};
      callback = callback || function(){};
      thisSlide = self.model.get('current-slide') + direction;
      if(thisSlide < 0)
        thisSlide = 0;
      if(thisSlide > self.model.get('slides')-1)
        thisSlide = self.model.get('slides')-1;

      // If we're triggered by the timer, and moving ahead, and on the last slide, then loop to the front
      if(self.options.loop === true && direction === 1 && opts.event === 'timer' && self.model.get('current-slide') === self.model.get('slides')-1)
        thisSlide = 0;

      // In single-flex mode, each child is a different width, and therefore when we want
      // to move, we need to figure out where to go
      if(self.options['slide-size'] === null && self.options['slide-mode'] === 'single-flex'){
        thisSlideChild = self.element.getChildren()[thisSlide];
        if(thisSlideChild){
          // iOS does different things with getCoordinates relative to the parent, so normalize on "offsetX" which do not take into account translate
          var coords = { left:thisSlideChild.offsetLeft, width:thisSlideChild.offsetWidth }; 
          var scroll = -self.getCurrentOffset();
          var alignmentOffset;

          target = coords.left;

          alignmentOffset = self.model.get('stage-size') - coords.width;
          if(self.options['slide-alignment'] === 'right')
            target -= alignmentOffset
          else if(self.options['slide-alignment'] === 'center')
            target -= alignmentOffset/2;
        }else{
          self._moving = false;
          callback && callback();
          return self;
        }

      }else{
        target = (thisSlide * self.model.get('stage-size')) - ((self.model.get('slide-offset-left')+self.model.get('slide-offset-right')) * thisSlide) - self.model.get('slide-offset-left');
      }

      // If we're at the end and in "sticky" ends alignement mode, then we will
      // pin our target to that value.
      if(self.options['slide-ends-alignment'] === 'sticky'){
        if(target < 0)
          target = 0;
        if(target > (self.model.get('total-size')) - self.model.get('stage-size'))
          target = (self.model.get('total-size')) - self.model.get('stage-size');
      }

      self.model.set('current-slide', thisSlide);
      self.element.set('data-slide-index', thisSlide);
      // based on target, not slide index
      self.element.set('data-position', target === 0 ? 'start': (target === (self.model.get('total-size')) - self.model.get('stage-size') ? 'end' : 'middle'));      

      if(self.nav)
        self.nav.setSelected(self.model.get('current-slide'));

      (function(){
        var onTransitionEnd = function(){
          $(window).removeEvent(Modernizr._transitionend+':relay(#'+self.element.get('id')+' > li:first-child)', onTransitionEnd);
          self.element.removeClass('-transitioning').removeClass('-from-'+opts.event);
          self.fireEvent('moved', { to:thisSlide });
          self._moving = false;
          callback && callback();
        };

        // If the raw offset (current scroll, if touching) is not the target, then animate
        if(self.getCurrentOffset(true) !== -target){
          if(Modernizr._transitionend){
            $(window).addEvent(Modernizr._transitionend+':relay(#'+self.element.get('id')+' > li:first-child)', onTransitionEnd);
            self.element.addClass('-transitioning').addClass('-from-'+opts.event);
          }
          self._move(-target);
          if(!Modernizr._transitionend)
            onTransitionEnd();

        // If we're in single and we're sticky, then it's possible that a next/previous would not actually move the carousel
        // if it's left is already less/more than the target. If that's the case, then keep moving.
        }else if(self.options['slide-ends-alignment'] === 'sticky' && self.options['slide-mode'].contains('single') && direction !== 0 && thisSlide > 0 && thisSlide < self.model.get('slides')-1){
          self._moving = false;
          self.move(direction > 0 ? 1 : -1, opts, onTransitionEnd);
        }else{
          onTransitionEnd();
        }
      }).delay(10);

      return self;
    },

    /**
     * A very dumb move function that sets the transform property to the correct position.
     * setAsOffset can be false to move it to an index that is not an actual offset (like, to halt a transition)
     *
     * @param  {Number}  to                 The position to move to
     * @param  {Boolean} [setAsOffset=true] Whether or not to set as our current offset.
     */
    _move: function(to, setAsOffset){
      this.element.getChildren().setStyle(this.options['transform-property'], 'translateX('+to+'px)');
      if(setAsOffset !== false)
        this.currentOffset = to;
      return this;
    },

    /**
     * Moves to an index, rather than a direction.
     *
     * @memberof! module:Carousel.Carousel#
     * @param {Number} index The index to move to
     * @param {Object} [opts] Options to pass to move
     * @param {Function} [callback] A callback to pass to move
     */
    moveToIndex: function(index, opts, callback){
      var self;
      self = this;
      self.move(index - self.model.get('current-slide'), opts, callback);
      return self;
    },

    /**
     * Moves forward one
     *
     * @memberof! module:Carousel.Carousel#
     */
    next: function(){
      return this.move(1);
    },

    /**
     * Moves backwards one
     *
     * @memberof! module:Carousel.Carousel#
     */
    previous: function(){
      return this.move(-1);
    },

    /**
     * Since we're not a MooVeeStar.View, we provide a way to detach the carousel from the element.
     * Removes all events, and destroys the nav if exists.
     *
     * @memberof! module:Carousel.Carousel#
     */
    detach: function(){
      var self;
      self = this;
      if(self.nav){
        self.nav.removeEvent('choose', self.onNavChoose);
        self.nav.destroy();
      }

      window.removeEvent('resize', self.onWindowResize);
      self.stop();
      self.element.removeClass('carousel-view');
      self.element.removeEvent('touchstart', self.onTouchStart);
      return self;
    },

    /**
     * If we auto instantiate a nav, this is added to events in initialize.
     * When we choose an item from the nav, we stop, move to that index, and start up again.
     *
     * @memberof! module:Carousel.Carousel#
     */
    onNavChoose: function(e){
      var self = this;
      self.stop().moveToIndex(e.index, null, function(){ self.start(); });
    },

    /**
     * If we resize the window, let's fix. There's a 50ms delay only do so on a resize pause.
     *
     * @memberof! module:Carousel.Carousel#
     * @param {Event} e The mootools resize event
     */
    onWindowResize: function(e){
      var self;
      self = this;
      self.stop();
      clearTimeout(self._resizeDelay);
      self._resizeDelay = (function(){
        var el = self.element.getFirst();
        self._move(0);
        self.model.set('current-slide',0);
        self.calculate().move(0).start();
      }).delay(50);
    },

    /**
     * If we're on a touch device,  this is added to events in initialize.
     * When a touch is started on the element, we set up some initial data and
     * listen for touchmove and touchend. Some of this logic was based off "Swipe"
     * https://github.com/bradbirdsall/Swipe/blob/master/swipe.js
     *
     * @memberof! module:Carousel.Carousel#
     * @param {Event} e The mootools touch event
     */
    onTouchStart: function(startEvent){
      var self, start, delta, isScrolling, onTouchMove, onTouchEnd;
      self = this;
      start = {
        scroll: -self.getComputedOffset(),  // The current offset, so we can stop it if we want
        x: startEvent.touches[0].pageX,
        y: startEvent.touches[0].pageY,
        time: +new Date
      };
      delta = {};

      onTouchMove = function(e){
        // Catch multi-touch and resizing
        if(e.touches.length > 1 || e.scale && e.scale !== 1)
          return

        // Once we move, stop the startEvent so we don't click any anchors
        startEvent.stop();

        delta = {
          x: e.touches[0].pageX - start.x,
          y: e.touches[0].pageY - start.y
        };

        if(Math.abs(delta.x) > 3 || Math.abs(delta.y) > 3){
          // Check if the user wants to scroll the page vertically, not swipe our gallery
          if(isScrolling == null)
            isScrolling = !!(Math.abs(delta.x) < Math.abs(delta.y));

          if(isScrolling === false){
            e.stop();
            var target = start.scroll - delta.x;

            // Resistance
            // If we're at (or beyond) the end, then add resistance. If we're in "sticky" ends alignment mode than
            // the end is at the end of our stage, however, if we're in aligned mode, then the end accomodates the
            // slide offsets when/if our slides are less than 100%
            if(target < 0 - (self.options['slide-ends-alignment'] === 'sticky' ? 0 : self.model.get('slide-offset-left'))){
              if(start.resistanceTargetLeft == null)
                start.resistanceTargetLeft = Math.abs(delta.x);
              target += (Math.abs(delta.x) - start.resistanceTargetLeft) / 1.25;
            }else if(target > (self.model.get('total-size')) - self.model.get('stage-size') + (self.options['slide-ends-alignment'] === 'sticky' ? 0 : self.model.get('slide-offset-right'))){
              if(start.resistanceTargetRight == null)
                start.resistanceTargetRight = Math.abs(delta.x);
              target -= (Math.abs(delta.x) - start.resistanceTargetRight) / 1.25;
            }else{
              delete start.resistanceTargetLeft;
              delete start.resistanceTargetRight;
            }

            self._move(-target, false);
          }
        }
      };

      onTouchEnd = function(e){
        var canMove = false;

        // We can move from the touch if we weren't scrolling,
        // and have moved more than 20px in 250ms, or moved more than half the slide width
        if(isScrolling === false)
          canMove = ((+new Date - start.time) < 250 && Math.abs(delta.x) > 20) || (Math.abs(delta.x) > self.model.get('stage-size') / 2);
        
        // Move, or snap back, or, if we haven't moved, just start up again
        self.element.removeClass('-touching').addClass('-from-touch');
        if(canMove)
          self.move(delta.x < 0 ? 1 : -1, { transition:'sine:out', event:'touch' }, function(){ self.start(); });
        else if(Math.abs(delta.x) > 0)
          self.move(0, { transition:'sine:out', event:'touch' }, function(){ self.start(); });
        else
          self.start().element.removeClass('-from-touch');

        self.element.removeClass('-touching');
        self.element.removeEvent('touchmove', onTouchMove);
        self.element.removeEvent('touchend', onTouchEnd);
      };

    
      self.stop();
      // If we're moving, then cut it off at the computed state
      if(self.element.hasClass('-transitioning')){
        self._move(-start.scroll, false);
        self.element.removeClass('-transitioning');
      }
      
      self.element.addClass('-touching');
      self.element.addEvent('touchmove', onTouchMove);
      self.element.addEvent('touchend', onTouchEnd);
    }

  });



  Carousel.Nav = new Class(/** @lends module:Carousel.Carousel.Nav.prototype */{
    Extends: MooVeeStar.View,

    events: {
      'click:relay(button)':'onButtonClick'
    },

    /**
     * Carousel nav is a quick nav implementation. This has nothing to do with the actual Carousel,
     * which simply listens for events this fires and updates it's instance automatically
     * 
     * @constructs Carousel.Nav
     * @extends MooVeeStar.View
     * @memberof! module:Carousel
     * @param {Number} numOfSlides The number of slides. Get's passed to update
     */
    initialize: function(numOfSlides){
      var self;
      self = this;
      self.element = new Element('nav.carousel-nav');
      self.parent(new MooVeeStar.Model({}));
      self.update(numOfSlides).setSelected();
    },

    /**
     * Sets the selected item by index
     * 
     * @memberof! module:Carousel.Carousel.Nav#
     * @param {Number} index The index of the selected slide
     */
    setSelected: function(index){
      var self, children;
      self = this;
      children = self.element.getChildren();
      children.removeClass('-selected');
      if(children[index || 0])
        children[index || 0].addClass('-selected');
      return this;
    },

    /**
     * Empties and reattached nav items based on the number passed in
     * 
     * @memberof! module:Carousel.Carousel.Nav#
     * @param {Number} numOfSlides The number of slides
     */
    update: function(numOfSlides){
      var self, frag, i;
      self = this;
      frag = document.createDocumentFragment();
      for(i = 0; i < numOfSlides || 0; i++){
        frag.appendChild(new Element('button[text="'+i+'"]'));
      }
      self.element.empty().appendChild(frag);
      self.setSelected(0);
      return this;
    },

    /**
     * When we click, we want "choose" the item.
     * 
     * @memberof! module:Carousel.Carousel.Nav#
     * @param {Event} e The mootools click event
     * @param {Element} target The button target clicked
     */
    onButtonClick: function(e, target){
      var self;
      self = this;
      self.fireEvent('choose', { index:self.element.getChildren().indexOf(target) || 0 });
      e.stop();
    }

  });

}).call(this);