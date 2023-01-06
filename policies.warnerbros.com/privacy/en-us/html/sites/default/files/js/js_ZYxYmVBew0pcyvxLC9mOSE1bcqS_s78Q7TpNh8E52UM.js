(function ($) {
    Drupal.behaviors.media_preview_sizer = {
        attach: function (context, settings) {
            //add in slider support for image sizing in the library
            //find the exposed filters and add the slider inline with them
            $(".media-browser-wrapper .views-exposed-form .views-exposed-widgets").once('media_preview_sizer').append("<div class='views-exposed-widget slide-widget'><label>Image Size</label><div class='slide-image'></div></div>");
            var valued = (!localStorage.getItem("slideWidth")) ? 200 : localStorage.getItem("slideWidth");
            //set a default CSS size for the list items
            $('#media-browser-library-list li').css('width', localStorage.getItem('slideWidth') + 'px');
            //using a preset image style with a max width of 300, set the minimum and starting value
            $('.slide-image').once('media_preview_sizer').slider({
                value: valued,
                min: 100,
                max: 300,
                step: 2,
                //when the slider moves, resize the image according to the px amount
                slide: function (event, ui) {
                    //store value in localstorage
                    localStorage.setItem('slideWidth', ui.value);
                    $('#media-browser-library-list li').css('width', localStorage.getItem('slideWidth') + 'px');
                }
            });
        }
    };
}(jQuery));
;
(function ($) {
  Drupal.behaviors.panopolyMagic = {
    attach: function (context, settings) {
 
      /**
       * Title Hax for Panopoly
       *
       * Replaces the markup of a node title pane with
       * the h1.title page element
       */
      if ($.trim($('.pane-node-title .pane-content').html()) == $.trim($('h1.title').html())) {
        $('.pane-node-title .pane-content').html('');
        $('h1.title').hide().clone().prependTo('.pane-node-title .pane-content');
        $('.pane-node-title h1.title').show();
      }
 
      // Focus on the 'Add' button for a single widget preview, after it's loaded.
      if (settings.panopoly_magic && settings.panopoly_magic.pane_add_preview_mode === 'single' && settings.panopoly_magic.pane_add_preview_subtype) {
        // Need to defer until current set of behaviors is done, because Panels
        // will move the focus to the first widget by default.
        setTimeout(function () {
          var link_class = 'add-content-link-' + settings.panopoly_magic.pane_add_preview_subtype.replace(/_/g, '-') + '-icon-text-button';
          $('#modal-content .panopoly-magic-preview-link .content-type-button a.' + link_class, context).focus();
        }, 0);
      }
    }
  };
})(jQuery);

(function ($) {
  // Used to only update preview after changes stop for a second.
  var timer;

  // Used to make sure we don't wrap Drupal.wysiwygAttach() more than once.
  var wrappedWysiwygAttach = false;

  // Used to make sure we don't wrap insertLink() on the Linkit field helper
  // more than once.
  var wrappedLinkitField = false;

  // Triggers the CTools autosubmit on the given form. If timeout is passed,
  // it'll set a timeout to do the actual submit rather than calling it directly
  // and return the timer handle.
  function triggerSubmit(form, timeout) {
    var $form = $(form),
        preview_widget = $('#panopoly-form-widget-preview'),
        submit;
    if (!preview_widget.hasClass('panopoly-magic-loading')) {
      preview_widget.addClass('panopoly-magic-loading');
      submit = function () {
        if (document.contains(form)) {
          $form.find('.ctools-auto-submit-click').click();
        }
      };
      if (typeof timeout === 'number') {
        return setTimeout(submit, timeout);
      }
      else {
        submit();
      }
    }
  }

  // Used to cancel a submit. It'll clear the timer and the class marking the
  // loading operation.
  function cancelSubmit(form, timer) {
    var $form = $(form),
        preview_widget = $('#panopoly-form-widget-preview');
    preview_widget.removeClass('panopoly-magic-loading');
    clearTimeout(timer);
  }

  function onWysiwygChangeFactory(editorId) {
    return function () {
      var textarea = $('#' + editorId),
          form = textarea.get(0).form;

      if (textarea.hasClass('panopoly-textarea-autosubmit')) {
        // Wait a second and then submit.
        cancelSubmit(form, timer); 
        timer = triggerSubmit(form, 1000);
      }
    };
  }

  // A function to run before Drupal.wysiwygAttach() with the same arguments.
  function beforeWysiwygAttach(context, params) {
    var editorId = params.field,
        editorType = params.editor,
        format = params.format;

    if (Drupal.settings.wysiwyg.configs[editorType] && Drupal.settings.wysiwyg.configs[editorType][format]) {
      wysiwygConfigAlter(params, Drupal.settings.wysiwyg.configs[editorType][format]);
    }
  }

  // Wouldn't it be great if WYSIWYG gave us an alter hook to change the
  // settings of the editor before it was attached? Well, we'll just have to
  // roll our own. :-)
  function wysiwygConfigAlter(params, config) {
    var editorId = params.field,
        editorType = params.editor,
        onWysiwygChange = onWysiwygChangeFactory(editorId);

    switch (editorType) {
      case 'markitup':
        $.each(['afterInsert', 'onEnter'], function (index, funcName) {
          config[funcName] = onWysiwygChange;
        });
        break;

      case 'tinymce':
        config['setup'] = function (editor) {
          editor.onChange.add(onWysiwygChange);
          editor.onKeyUp.add(onWysiwygChange);
        }
        break;
    }
  }

  // Used to wrap a function with a beforeFunc (we use it for wrapping
  // Drupal.wysiwygAttach()).
  function wrapFunctionBefore(parent, name, beforeFunc) {
    var originalFunc = parent[name];
    parent[name] = function () {
      beforeFunc.apply(this, arguments);
      return originalFunc.apply(this, arguments);
    };
  }

  // Used to wrap a function with an afterFunc (we use it for wrapping
  // insertLink() on the Linkit field helper);
  function wrapFunctionAfter(parent, name, afterFunc) {
    var originalFunc = parent[name];
    parent[name] = function () {
      var retval = originalFunc.apply(this, arguments);
      afterFunc.apply(this, arguments);
      return retval;
    };
  }


  /**
   * Improves the Auto Submit Experience for CTools Modals
   */
  Drupal.behaviors.panopolyMagicAutosubmit = {
    attach: function (context, settings) {
      // Replaces click with mousedown for submit so both normal and ajax work.
      $('.ctools-auto-submit-click', context)
      // Exclude the 'Style' type form because then you have to press the
      // "Next" button multiple times.
      // @todo: Should we include the places this works rather than excluding?
      .filter(function () { return $(this).closest('form').attr('id').indexOf('panels-edit-style-type-form') !== 0; })
      .click(function(event) {
        if ($(this).hasClass('ajax-processed')) {
          event.stopImmediatePropagation();
          $(this).trigger('mousedown');
          return false;
        }
      });

      // e.keyCode: key
      var discardKeyCode = [
        16, // shift
        17, // ctrl
        18, // alt
        20, // caps lock
        33, // page up
        34, // page down
        35, // end
        36, // home
        37, // left arrow
        38, // up arrow
        39, // right arrow
        40, // down arrow
         9, // tab
        13, // enter
        27  // esc
      ];

      // Special handling for link field widgets. This ensures content which is ahah'd in still properly autosubmits.
      $('.field-widget-link-field input:text', context).addClass('panopoly-textfield-autosubmit').addClass('ctools-auto-submit-exclude');

      // Handle text fields and textareas.
      $('.panopoly-textfield-autosubmit, .panopoly-textarea-autosubmit', context)
      .once('ctools-auto-submit')
      .bind('keyup blur', function (e) {
        var $element;
        $element = $('.panopoly-magic-preview .pane-title', context);

        cancelSubmit(e.target.form, timer);

        // Filter out discarded keys.
        if (e.type !== 'blur' && $.inArray(e.keyCode, discardKeyCode) > 0) {
          return;
        }

        // Set a timer to submit the form a second after the last activity.
        timer = triggerSubmit(e.target.form, 1000);
      });

      // Handle WYSIWYG fields.
      if (!wrappedWysiwygAttach && typeof Drupal.wysiwygAttach == 'function') {
        wrapFunctionBefore(Drupal, 'wysiwygAttach', beforeWysiwygAttach);
        wrappedWysiwygAttach = true;

        // Since the Drupal.behaviors run in a non-deterministic order, we can
        // never be sure that we wrapped Drupal.wysiwygAttach() before it was
        // used! So, we look for already attached editors so we can detach and
        // re-attach them.
        $('.panopoly-textarea-autosubmit', context)
        .once('panopoly-magic-wysiwyg')
        .each(function () {
          var editorId = this.id,
              instance = Drupal.wysiwyg.instances[editorId],
              format = instance ? instance.format : null,
              trigger = instance ? instance.trigger : null;

          if (instance && instance.editor != 'none') {
            params = Drupal.settings.wysiwyg.triggers[trigger];
            if (params) {
              Drupal.wysiwygDetach(context, params[format]);
              Drupal.wysiwygAttach(context, params[format]);
            }
          }
        });
      }
  
      // Handle autocomplete fields.
      $('.panopoly-autocomplete-autosubmit', context)
      .once('ctools-auto-submit')
      .bind('keyup blur', function (e) {
        // Detect when a value is selected via TAB or ENTER.
        if (e.type === 'blur' || e.keyCode === 13) {
          // We defer the submit call so that it happens after autocomplete has
          // had a chance to fill the input with the selected value.
          triggerSubmit(e.target.form, 0);
        }
      });

      // Prevent ctools auto-submit from firing when changing text formats.
      $(':input.filter-list').addClass('ctools-auto-submit-exclude');

      // Handle Linkit fields.
      if (!wrappedLinkitField && typeof Drupal.linkit !== 'undefined') {
        var linkitFieldHelper = Drupal.linkit.getDialogHelper('field');
        if (typeof linkitFieldHelper !== 'undefined') {
          wrapFunctionAfter(linkitFieldHelper, 'insertLink', function (data) {
            var element = document.getElementById(Drupal.settings.linkit.currentInstance.source);
            triggerSubmit(element.form);
          });
          wrappedLinkitField = true;
        }
      }

    }
  }
})(jQuery);
;
(function ($) {

  Drupal.behaviors.PanelsAccordionStyle = {
    attach: function (context, settings) {
      for (region_id in Drupal.settings.accordion) {
        var accordion = Drupal.settings.accordion[region_id];
        if (jQuery('#'+region_id).hasClass("ui-accordion")) {
          jQuery('#'+region_id).accordion("refresh");
        } else {
          jQuery('#'+region_id).accordion(accordion.options);
        }
      }
    }
  };

})(jQuery);
;


(function ($, Drupal, window, document, undefined) {
    var WBPortalSelector = function (default_portal, country_list) {
        // country code associated with the current portal
        this.default_portal = default_portal;

        this.country_list = country_list;
        // jQuery object of the root element
        this.$element = null
        // localizable strings
        this.localization = {
            en: {
                SUGGESTION: "You are currently browsing our $1 site.",
                SUGGESTION_TWO: "Would you like to visit our $2 site?",
                MORE: "More Territories",
                //AU_SITE: "Australian",
                BE_SITE: "Belgian",
                BR_SITE: "Brazilian",
                CA_SITE: "Canadian",
                CH_SITE: "Switzerland",
                DK_SITE: "Danish",
                FI_SITE: "Finnish",
                FR_SITE: "French",
                DE_SITE: "German",
                IN_SITE: "Indian",
                IT_SITE: "Italian",
                JP_SITE: "Japanese",
                LA_SITE: "Latin American",
                MX_SITE: "Mexico",
                NL_SITE: "Dutch",
                NO_SITE: "Norwegian",
                PT_SITE: "Portuguese",
                ES_SITE: "Spanish",
                RU_SITE: "Russian",
                SE_SITE: "Swedish",
                TR_SITE: "Turkish",
                UK_SITE: "UK",
                US_SITE: "US"
            },
            de: {
                SUGGESTION: "Sie befinden sich momentan auf der $1 Website.",
                SUGGESTION_TWO: "Möchten Sie unsere $2 Website besuchen?",
                MORE: "Weitere Sprachen",
                DE_SITE: "Deutsche",
            },
            es: {
                SUGGESTION: "Actualmente estás navegando por nuestra web de $1.",
                SUGGESTION_TWO: "¿Te gustaría visitar nuestra web $2?",
                MORE: "Otros territorios",
                //AU_SITE: "la página de Australia",
                BE_SITE: "la página de Bélgica",
                BR_SITE: "la página de Brasil",
                CA_SITE: "la página de Canadá",
                CH_SITE: "la página de Suiza",
                DK_SITE: "la página de Dinamarca",
                FI_SITE: "la página de Finlandia",
                FR_SITE: "la página de Francia",
                DE_SITE: "la página de Alemania",
                IN_SITE: "la página de India",
                IT_SITE: "la página de Italia",
                JP_SITE: "la página de Japón",
                LA_SITE: "la página de América Latina",
                MX_SITE: "la página de México",
                NL_SITE: "la página de Países Bajos",
                NO_SITE: "la página de Noruega",
                PT_SITE: "la página de Portugal",
                ES_SITE: "la página de España",
                SE_SITE: "la página de Suecia",
                TR_SITE: "la página de Turquía",
                UK_SITE: "la página de Reino Unido",
                US_SITE: "la página de Estados Unidos"
            },
            fr: {
                SUGGESTION: "Vous vous trouvez sur le site $1 en ce moment. ",
                SUGGESTION_TWO: "Voulez-vous être redirigé vers le site $2?",
                MORE: "Autres Pays",
                //AU_SITE: "Australian",
                BE_SITE: "Belgique",
                BR_SITE: "Brésil",
                CA_SITE: "Canada",
                CH_SITE: "Suisse",
                DK_SITE: "Danemark",
                FI_SITE: "Finlande",
                FR_SITE: "France",
                DE_SITE: "Allemagne",
                IN_SITE: "Indien",
                IT_SITE: "Italie",
                JP_SITE: "Japon",
                LA_SITE: "Amérique Latine",
                MX_SITE: "Mexique",
                NL_SITE: "Belgique",
                NO_SITE: "Norvège",
                PT_SITE: "Portugal",
                ES_SITE: "Espagne",
                RU_SITE: "Russie",
                SE_SITE: "Suédois",
                TR_SITE: "Turquie",
                UK_SITE: "Grande Bretagne",
                US_SITE: "Etats-Unis"
            },
            it: {
                SUGGESTION: "Stai visualizzando la versione $1 del nostro sito.",
                SUGGESTION_TWO: "Desideri visualizzare il nostro sito $2?",
                MORE: "Altri paesi",
                IT_SITE: "italiano",
                US_SITE: "americana"
            },
            ja: {
                SUGGESTION: "こちらは$1です。",
                SUGGESTION_TWO: "$2に移動しますか？",
                MORE: "その他の国",
                //AU_SITE: "オーストラリアの公式サイト",
                BE_SITE: "ベルギーの公式サイト",
                BR_SITE: "ブラジルの公式サイト",
                CA_SITE: "カナダの公式サイト",
                DK_SITE: "デンマークの公式サイト",
                FI_SITE: "フィンランドの公式サイト",
                FR_SITE: "フランスの公式サイト",
                DE_SITE: "ドイツの公式サイト",
                IN_SITE: "インドの公式サイト",
                IT_SITE: "イタリアの公式サイト",
                JP_SITE: "日本の公式サイト",
                LA_SITE: "ラテンアメリカの公式サイト",
                MX_SITE: "ラテンアメリカの公式サイト",
                NL_SITE: "オランダの公式サイト",
                NO_SITE: "ノルウェイの公式サイト",
                PT_SITE: "ポルトガルの公式サイト",
                ES_SITE: "スペインの公式サイト",
                SE_SITE: "スウェーデンの公式サイト",
                TR_SITE: "トルコの公式サイト",
                UK_SITE: "イギリスの公式サイト",
                US_SITE: "アメリカの公式サイト"
            },
            nl: {
                SUGGESTION: "Je bevindt je momenteel op de $1 website.",
                SUGGESTION_TWO: "Wil je graag de $2 website bezoeken?",
                MORE: "Ander land",
                NL_SITE: "Nederlandse",
                BE_SITE: "Belgische",
                BR_SITE: "Braziliaanse",
                CA_SITE: "Canadese",
                CH_SITE: "Zwitserse",
                DK_SITE: "Deense",
                FI_SITE: "Finse",
                FR_SITE: "Franse",
                DE_SITE: "Duitse",
                IN_SITE: "Indiërs",
                IT_SITE: "Italiaanse",
                JP_SITE: "Japanse",
                LA_SITE: "Latijns Amerikaanse",
                MX_SITE: "Mexicaanse",
                NL_SITE: "Nederlandse",
                NO_SITE: "Norweegse",
                PT_SITE: "Portugese",
                ES_SITE: "Spaanse",
                SE_SITE: "Zweedse",
                TR_SITE: "Turkse",
                UK_SITE: "Engelse",
                US_SITE: "Amerikaanse"
            },
            pt: {
                SUGGESTION: "Você esta navegando no $1.",
                SUGGESTION_TWO: "Gostaria de visitar o $2?",
                MORE: "Outros países",
                //AU_SITE: "site da Austrália",
                BE_SITE: "site da Bélgica",
                BR_SITE: "site do Brasil",
                CA_SITE: "site da Canadá",
                CH_SITE: "site da Suisse",
                DK_SITE: "site da Dinamarca",
                FI_SITE: "site da Finlândia",
                FR_SITE: "site da França",
                DE_SITE: "site da Alemanha",
                IN_SITE: "site da Índia",
                IT_SITE: "site da Itália",
                JP_SITE: "site do Japão",
                LA_SITE: "site da América Latina",
                MX_SITE: "site da México",
                NL_SITE: "site dos Países Baixos",
                NO_SITE: "site da Noruega",
                PT_SITE: "site do Portugal",
                ES_SITE: "site da Espanha",
                SE_SITE: "site da Suécia",
                TR_SITE: "site da Turquia",
                UK_SITE: "site do Reino Unido",
                US_SITE: "site dos EUA"
            },
            tr: {
                SUGGESTION: "Şuanda $1 sitemizi ziyaret ediyorsunuz.",
                SUGGESTION_TWO: "$2 sitemizi ziyaret etmek ister misiniz?",
                MORE: "Diğer ülkeler",
                TR_SITE: "Türkçe"
            },
            sv: {
                SUGGESTION: "Du är för närvarande inne på vår $1 hemsida.",
                SUGGESTION_TWO: "Önskar du besöka den $2 hemsidan?",
                MORE: "Fler länder",
                SE_SITE: "svenska",
                US_SITE: "amerikanska"
            },
            da: {
                SUGGESTION: "Du kigger i øjeblikket på vores $1 hjemmeside.",
                SUGGESTION_TWO: "Vil du besøge vores $2 hjemmeside?",
                MORE: "Flere områder",
                DK_SITE: "danske",
                US_SITE: "amerikanske"
            },
            no: {
                SUGGESTION: "Du kigger i øjeblikket på vores $1 hjemmeside.",
                SUGGESTION_TWO: "ønsker du å gå til den $2 nettsiden?",
                MORE: "andre territorier",
                NO_SITE: "norske",
                US_SITE: "amerikanske"
            },
            fi: {
                SUGGESTION: "selaat tällä hetkellä meidän $1 verkkosivuja.",
                SUGGESTION_TWO: "haluatko $2 verkkosivuille?",
                MORE: "lisää maita",
                FI_SITE: "Suomen",
                US_SITE: "yhdysvaltalaisia"
            },
            ru: {
                SUGGESTION: "активна $1 версия сайта.",
                SUGGESTION_TWO: "перейти на $2 версию сайта?",
                MORE: "больше языков",
                RU_SITE: "русскоязычную",
                US_SITE: "англоязычная"
            }
        };

        // list of supported portals mapped to the language to use for localization
        this.supported_portals = {
            //"au": "en",
            "be": "fr",
            "br": "pt",
            "ca": "en",
            "ch": "de",
            "dk": "da",
            "de": "de",
            "es": "es",
            "fi": "fi",
            "fr": "fr",
            "in": "en",
            "it": "it",
            "jp": "ja",
            "la": "es",
            "mx": "es",
            "nl": "nl",
            "no": "no",
            "pt": "pt",
            //"ru": "ru",
            "se": "sv",
            "tr": "tr",
            "uk": "en",
            "us": "en"
        };
        this.translationKeys = ['SUGGESTION','SUGGESTION_TWO', 'MORE'];
        for( var key in this.supported_portals){
           this.translationKeys.push( key.toUpperCase() + "_SITE" );
        }
        //console.log( "TRANSLATION KEYS ::: ", this.translationKeys );
    };

    WBPortalSelector.prototype.start = function (config) {
        var test_locale = this.getParam("test_locale");
        if (test_locale) {
            this.suggest(test_locale);
        } else {
            var that = this;
            if (!this.wasSuggested()) {
                $.ajax({
                    url: config.service,
                    dataType: "json",
                    crossDomain: true,
                    cache: false,
                    success: function (result) {
                        var user_country = result.country_code.toLowerCase();

                        // Group Latin American countries
                        if ($.inArray(user_country, ["mx"]) !== -1) {
                            user_country = "la"
                        }

                        that.suggest(result.country_code.toLowerCase());
                        that.markAsSuggested();
                    }
                });
            }
        }
    };

    WBPortalSelector.prototype.getParam = function (name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    };

    WBPortalSelector.prototype.wasSeen = function () {
        return Cookies.read(Cookies.cookie_seen);
    };

    WBPortalSelector.prototype.wasSuggested = function () {
        return Cookies.read(Cookies.cookie_suggested);
    };

    WBPortalSelector.prototype.markAsSuggested = function () {
         if(
            (Drupal.behaviors.truste && Drupal.behaviors.truste.TRUST_E_ACCEPTED)
            || !Drupal.behaviors.truste
        ) {
          Cookies.create(Cookies.cookie_suggested, 1, 365);
        }
   }


    WBPortalSelector.prototype.markAsSeen = function () {
        if (Drupal.behaviors.truste && Drupal.behaviors.truste.TRUST_E_ACCEPTED) {
          Cookies.create(Cookies.cookie_seen, 1, 365);
        } else if (!Drupal.behaviors.truste) {
          Cookies.create(Cookies.cookie_seen, 1, 365);
        }
    };

    WBPortalSelector.prototype.suggest = function (user_country) {
        // Normalize certain countries into groups
        switch (user_country) {
            // Argentina, Bolivia, Chile, Colombia, Costa Rica, Ecuador, El Salvador, Mexico
            case "ar":
            case "bo":
            case "cl":
            case "co":
            case "cr":
            case "ec":
            case "sv":
            case "gt":
            case "hn":
            case "ni":
            case "pa":
            case "py":
            case "pe":
            case "do":
            case "uy":
            case "ve":
                user_country = "la";
                break;

            // Ireland
            case "ie":
                user_country = "uk";
                break;

            // Luxembourg
            case "lu":
                user_country = "be";
                break;

            // New Zealand
            case "nz":
                user_country = "uk";
                break;
        }

        if (this.supported_portals.hasOwnProperty(user_country) && user_country !== this.default_portal) {
            this.insertSuggestion(user_country);
        }
    };

    WBPortalSelector.prototype.wasRedirected = function () {
        return Cookies.read(Cookies.cookie_country);
    };

    WBPortalSelector.prototype.markAsRedirected= function (country) {
        if (Drupal.behaviors.truste && Drupal.behaviors.truste.TRUST_E_ACCEPTED) {
          Cookies.create(Cookies.cookie_country, code, 365);
        } else if (!Drupal.behaviors.truste) {
          Cookies.create(Cookies.cookie_country, code, 365);
        }
    };

    WBPortalSelector.prototype.redirectByCountryCode = function (country_code) {
        // get mapping of country code and path
        var result = $.grep(Drupal.settings.globalIpSniffer.languages, function(e){ if (e.country_code) return e.country_code.toLowerCase() == country_code.toLowerCase(); });
        if (result.length == 1) window.location.replace(result.pop().prefix);
    };

    WBPortalSelector.prototype.getTranslationStrings = function (user_country) {
        var strings = this.localization[this.supported_portals[user_country]] || this.localization["en"];
        for(var i= 0, l=this.translationKeys.length; i<l; i++){
            try{
                var key = this.translationKeys[i];
                strings[key] = strings[key] || this.localization['en'][key];
            }catch(e){
                console.warn( 'WBPortalSelectr::getTranslationStrings::', e );
            }
        }
        return strings;

    },
    WBPortalSelector.prototype.insertSuggestion = function (user_country) {
        var strings = this.getTranslationStrings( this.default_portal );

        var $element = $("#wbportalselector");
        var $countries = $( this.country_list );
        if(!$element.length){

            $('body').prepend('<div id="wbportalselector">' +
                '<div class="suggestion-container">'+
                    '<span class="origin-flag flag"></span>'+
                    '<span class="suggestion one"></span><br />'+
                    '<span class="suggestion two"></span>'+
                    '<a class="destination-flag flag"></a>'+
                    '<a href="#" class="more-territories"></a>'+
                    '<a href="#" class="dismiss-selector"></a>'+
                '</div>'+
            '</div>');

            $element = $("#wbportalselector");
        }

//debugger;
        var portal_url = $("li." + user_country+" a" ,$countries ).attr("href");
        var tracking_tag = "cel=ip_menu";
        if( (/https?:\/\/.+\?.+=.+/).test(portal_url)){
            portal_url += "&"+tracking_tag;
        }else{
            portal_url += "?"+tracking_tag;
        }


        //console.log( portal_url );
        $(".origin-flag", $element).addClass( this.default_portal );
        $(".destination-flag", $element).addClass( user_country ).attr('href', portal_url );

        var phrase = strings.SUGGESTION;
        var phrase2 = strings.SUGGESTION_TWO;
        var originCountryText = strings[ this.default_portal.toUpperCase() + "_SITE" ];
        var suggestedCountryText = strings[ user_country.toUpperCase() + "_SITE" ];
        phrase = phrase.replace("$1", originCountryText );
        phrase2 = phrase2.replace("$2", '<a href="' + portal_url + '">' + suggestedCountryText + '</a>');

        if(user_country != 'ja'){
            phrase +="&nbsp;";
        }

        $(".suggestion.one", $element).html(phrase);
        $(".suggestion.two", $element).html(phrase2);

        var that = this;
        $("a.more-territories", $element).text(strings.MORE).click(function (e) {
            e.preventDefault();
            $(this).toggleClass("open");
            that.toggleMoreTerritories();
        });

        $("a.dismiss-selector", $element).click(function (e) {
            e.preventDefault();
            that.dismissSuggestion();
        });

        setTimeout( function(){
             $element.hide().slideDown();
        }, 250);
        this.$element = $element.hide();
        //this.$element = $element.hide().slideDown();
    };

    WBPortalSelector.prototype.dismissSuggestion = function () {
        this.$element.slideUp();
    };

    WBPortalSelector.prototype.toggleMoreTerritories = function () {
        window.location = '/international';
    };

    WBPortalSelector.prototype.redirectPageByCountry = function (config) {
        var test_country = this.getParam("test_country");
        var that = this;
        if (test_country) {
            that.markAsRedirected(test_country);
            that.redirectByCountryCode(test_country);
        } else {
            // check country code (country_code)
            $.ajax({
                url: config.service,
                dataType: "json",
                cache: false,
                success: function (result) {
                    var user_country = result.country_code.toLowerCase();
                    if (user_country) {
                        that.markAsRedirected(user_country);
                        that.redirectByCountryCode(user_country);
                    }
                }
            });
        }
    };



    var Cookies = {
        cookie_seen: "wbportalselector_seen",
        cookie_suggested: "wbportalsuggestion_seen",
        cookie_country: "wbportalselector_country",
        create: function (name, value, days) {
            var expires = "";
            if (days) {
                var date = new Date();

                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toGMTString();
            }

            document.cookie = name + "=" + value + expires + "; path=/";
        },
        read: function (name) {
            name = name + "=";
            var ca = document.cookie.split(';');
            var c, i, l = ca.length;
            for(var i = 0; i < l; i++) {
                c = ca[i];
                while (c.charAt(0)==' ') {
                    c = c.substring(1, c.length);
                }

                if (c.indexOf(name) == 0) {
                    return c.substring(name.length, c.length);
                }
            }

            return null;
        },
        erase: function (name) {
            Cookies.create(name, "", -1);
        }
    };
    Drupal.behaviors.globalIpSniffer = {
        attach: function (context, settings) {

            //wait to accept truste before moving executing only do this if trust e exists
            if (Drupal.behaviors.truste && !Drupal.behaviors.truste.TRUST_E_ACCEPTED) {
                //wait for acceptance
                window.setTimeout($.proxy(this.attach, this, context, settings), 250);
                return;
            }

            //console.info( "settings ::: ", settings  );
            try{

                if( self != top || settings.globalIpSniffer.ignore_portal_suggestion_notification ){ return; };
                var selector = new WBPortalSelector( settings.globalIpSniffer.region, settings.globalIpSniffer.markup );
                var config = {
                    service: (settings.globalIpSniffer.use_cloudflare_geoip == 1) ? "/api/getip" : "https://freegeoip.net/json/"
                }
                if (!selector.wasRedirected() && settings.globalIpSniffer.enable_redirect == 1) {
                    selector.redirectPageByCountry(config);
                } else {
                    selector.start(config);
                }

            }catch(e){
               console.warn( "Drupal.behaviors.globalIpSniffer : ", e.message );
            }
        }
    };

})(jQuery, Drupal, this, this.document);
;
//This file is for wb homepage featured promo pods hover behavior
// - Overlays for Movies, TV, Video Games and Music
// - Tooltip for Apps
(function ($, Drupal, window, document, undefined) {
    Drupal.behaviors.add_custom_tooltip = {
        attach: function(context) {
            var homeDiv = $('.homepage-divisional');
            if (!(homeDiv && homeDiv.length)) return;

            var toolTipDiv = $('<div id="appToolTip">');
            var iTunesLink = $('<a>', {
                        'target': "_blank",
                        'href': "",
                        'data-link-type': "ios",
                        'html': "App Store"
                    });
            var hr = $('<div>', {
                        'class': "h-rule"
                    });
            var playStoreLink = $('<a>', {
                        'target': "_blank",
                        'href': "",
                        'data-link-type': "android",
                        'html': "Google Play Store"
                    });
            toolTipDiv.append(iTunesLink).append(hr).append(playStoreLink);
            homeDiv.once().append(toolTipDiv);
            toolTipDiv.hide();

            // check user agent
            var userAgent = navigator.userAgent.toLowerCase();
            var isIos = userAgent.match(/ios|iphone|ipad|ipod/);
            var isAndroid = !isIos && userAgent.match(/android/);

            // get all the Apps items
            var items = $('.homepage-divisional .section-apps .views-row a');

            var viewMore = $('.homepage-divisional .section-apps .more-link a');
            if (viewMore) {
                // Override the 'View More' link to use tooltip. Add 'data-ios-tooltip' and 'data-android-tooltip' to 'View More'
                viewMore.attr('data-ios-tooltip', 'http://itunes.apple.com/us/artist/warner-bros/id298372283');
                viewMore.attr('data-android-tooltip', 'https://play.google.com/store/apps/developer?id=Warner+Bros.+International+Enterprises');
                // add 'View More' to the items array.
                items.push(viewMore[0]);
            }

            // add hover behavior to show tooltip
            if (items.length) {
                items.hover(
                    // hover in handler
                    function(event){
                        var target = $(event.currentTarget);

                        if( !target  || !target.offset() ){

                           return;
                        }

                        var ios_store_url = $.trim(target.attr('data-ios-tooltip'));
                        var android_store_url = $.trim(target.attr('data-android-tooltip'));
                        var target_url = $.trim(target.attr('href'));

                        // replace the iTunes Store target link to Google Play Store link for Android devices
                        if (isAndroid && target_url != android_store_url) target.attr('href', android_store_url);

                        // hide tooltip for mobile devices
                        if (isAndroid || isIos) return;

                        toolTipDiv.show();


                        var ios_link_el =  $('#appToolTip a[data-link-type="ios"]');
                        var android_link_el = $('#appToolTip a[data-link-type="android"]');
                        var hr_el = $('#appToolTip .h-rule')

                        // update the tooltip links
                        ios_link_el.attr('href', ios_store_url);
                        android_link_el.attr('href', android_store_url);

                        // hide elements for links that are not available
                        if (!ios_store_url || ios_store_url == "") {
                            hr_el.hide();
                            ios_link_el.hide();
                        } else {
                            ios_link_el.show();
                        }
                        // hide Google Play Store link if not available
                        if (!android_store_url || android_store_url == "") {
                            hr_el.hide();
                            android_link_el.hide();
                        } else {
                            android_link_el.show();
                        }
                        if (android_store_url != "" && ios_store_url != "") {
                            hr_el.show();
                        }

                         // move the tooltip under the app image and title
                        var vertical_offset = 1; // examples: .9 (lowers modal), 1.1 (raises modal)
                        var coords = {
                            top: target.offset().top + target.height() * vertical_offset,
                            left: target.offset().left + ( ( target.width() - toolTipDiv.width() ) * 0.75 )
                        }
                        toolTipDiv.offset( coords );

                    },
                    // hover out handler
                    function(event) {
                        var relTarget = event.toElement ? event.toElement : event.relatedTarget;
                        if( relTarget == toolTipDiv[0]){
                            return false;
                        }

                        toolTipDiv.hide();
                    }
                )
            }


            toolTipDiv.mouseleave(function(event){
                $(event.currentTarget).hide();
            });



            // add divisional hover
            // subheading overlay for the rest (movies, tv, videogames, music)
            $('.section-featured-pods:not(.section-apps) a').hover(
                function(event){
                    $(event.currentTarget).find('.subheading-overlay').show();
                },
                function(event){
                    $(event.currentTarget).find('.subheading-overlay').hide();
                }
            )

        }
    };

})(jQuery, Drupal, this, this.document);
;
