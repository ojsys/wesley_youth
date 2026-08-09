/* =====================================================================
   The renderer.

   Turns a page from the content model into HTML. Used by BOTH the public
   website and the editing canvas inside the CMS, which is why a change
   made in the editor looks exactly like the published page — there is only
   one piece of code that draws anything.

   Exposes:
     RENDER.page(content, page, opts)    the sections of one page
     RENDER.nav(content, page)           the menu bar
     RENDER.footer(content, page)        the footer
     RENDER.activate(root, opts)         start slideshows, counters, reveals
     RENDER.emblem(content, opts)        the logo, however it is set
     RENDER.editRuntime(root)            click-to-select, for the CMS canvas

   `opts.edit` switches on the editing affordances: every section, row,
   column and element is tagged with its id, links stop navigating, and
   clicking anything tells the CMS what was clicked.
   ===================================================================== */
(function (global) {
    'use strict';

    var B = global.BLOCKS;

    /* =================================================================
       Small helpers
       ================================================================= */
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* A URL going into a href/src. Anything that is not plainly safe is
       dropped, so a pasted `javascript:` link can never become a trap. */
    function safeUrl(u) {
        var s = String(u == null ? '' : u).trim();
        if (!s) return '';
        if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(s)) return esc(s);
        if (/^[a-z0-9._~\-]+(\/|$)/i.test(s) && !/^[a-z][a-z0-9+.\-]*:/i.test(s)) return esc(s);
        return '';
    }

    /* Rich text comes from the CMS toolbar, but it is still stored markup
       being put back on a page — strip the things that could execute. */
    function safeHtml(html) {
        var s = String(html == null ? '' : html);
        s = s.replace(/<\s*(script|style|iframe|object|embed|form|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
        s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, '');
        s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
        s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
        s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
        s = s.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
        return s;
    }

    function cls() {
        var out = [];
        for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
        return out.join(' ');
    }

    function px(n, fallback) {
        var v = parseFloat(n);
        return (isFinite(v) ? v : fallback) + 'px';
    }
    function numOr(n, fallback) {
        var v = parseFloat(n);
        return isFinite(v) ? v : fallback;
    }

    function alignClass(a) {
        return a === 'center' ? 'ta-c' : a === 'right' ? 'ta-r' : 'ta-l';
    }

    /* The colour choices offered on text-bearing elements. */
    function colourStyle(choice, custom) {
        switch (choice) {
            case 'ink':    return 'color:var(--ink);';
            case 'muted':  return 'color:var(--muted);';
            case 'gold':   return 'color:var(--gold-deep);';
            case 'cream':  return 'color:var(--cream);';
            case 'custom': return custom ? 'color:' + esc(custom) + ';' : '';
            default:       return '';
        }
    }

    function titleHTML(main, accent) {
        return esc(main) + (accent ? ' <span class="gold">' + esc(accent) + '</span>' : '');
    }

    function iconClass(name) {
        var n = String(name || '').trim();
        if (!n) return '';
        // Already carries a style prefix (fas / far / fab …)?
        return /^(fa[srlbdt]|fa-brands|fa-solid|fa-regular)\s/.test(n) ? n : 'fas ' + n;
    }

    function iconHTML(name, extra) {
        var c = iconClass(name);
        return c ? '<i class="' + esc(c) + (extra ? ' ' + extra : '') + '"></i>' : '';
    }

    /* =================================================================
       Editing tags. In edit mode every part of the page carries its id so
       a click can be turned back into "the user selected this element".
       ================================================================= */
    function tag(ctx, kind, id) {
        if (!ctx.edit) return '';
        var sel = ctx.selected && ctx.selected.id === id ? ' is-selected' : '';
        return ' data-kind="' + kind + '" data-id="' + esc(id) + '" data-ed="1"' +
               (sel ? ' data-selected="1"' : '');
    }
    function editClass(ctx, kind, id) {
        if (!ctx.edit) return '';
        return 'ed-' + kind + (ctx.selected && ctx.selected.id === id ? ' is-selected' : '');
    }

    /* The little floating label with the move / copy / delete buttons.
       `opts.buttons` names which of them this kind of thing gets — a column
       has no delete, for instance, because the row's layout is what decides
       how many columns there are. */
    var TOOLBAR_BUTTONS = {
        up:        ['fa-arrow-up',  'Move up'],
        down:      ['fa-arrow-down','Move down'],
        add:       ['fa-plus',      'Add an element here'],
        duplicate: ['fa-clone',     'Make a copy'],
        'delete':  ['fa-trash',     'Delete']
    };

    function toolbar(ctx, kind, id, label, opts) {
        if (!ctx.edit) return '';
        opts = opts || {};
        var wanted = opts.buttons || ['up', 'down', 'duplicate', 'delete'];

        var buttons = wanted.map(function (act) {
            var spec = TOOLBAR_BUTTONS[act];
            if (!spec) return '';
            return '<button type="button" class="ed-btn" data-act="' + act + '" data-kind="' + kind +
                   '" data-id="' + esc(id) + '" title="' + esc(spec[1]) + '" aria-label="' + esc(spec[1]) + '">' +
                   '<i class="fas ' + spec[0] + '"></i></button>';
        }).join('');

        return '<div class="ed-bar ed-bar--' + kind + '">' +
            '<span class="ed-tag" data-act="select" data-kind="' + kind + '" data-id="' + esc(id) + '">' +
                (opts.icon ? '<i class="fas ' + esc(opts.icon) + '"></i> ' : '') + esc(label) +
            '</span>' + buttons +
        '</div>';
    }

    /* =================================================================
       The logo, however it has been set in the CMS.
       ================================================================= */
    function emblem(content, opts) {
        opts = opts || {};
        var b = content.brand || {};
        var extra = opts.className ? ' ' + opts.className : '';
        var style = opts.style ? ' style="' + opts.style + '"' : '';
        if (b.logoImage) {
            return '<img class="emblem' + extra + '" src="' + safeUrl(b.logoImage) +
                   '" alt="' + esc(b.titleFull || '') + '"' + style + '>';
        }
        return '<svg class="emblem' + extra + '" viewBox="0 0 200 200" role="img" aria-label="' +
               esc(b.titleFull || '') + '"' + style + '><use href="#emblemDef"/></svg>';
    }

    /* =================================================================
       Menu bar
       ================================================================= */
    function navLinkHref(content, l) {
        // A menu entry can point at a page by id, or hold a plain address.
        if (l.pageId) {
            var p = global.SITE.pageById(content, l.pageId);
            if (p) return global.SITE.pageUrl(p);
        }
        return l.href || '#';
    }

    function nav(content, page) {
        var n = content.nav || {};
        var b = content.brand || {};
        var home = global.SITE.homePage(content);

        var text = '';
        if (b.showTitle    !== false) text += '<strong>' + esc(b.titleFull) + '</strong>';
        if (b.showSubtitle !== false) text += '<span>' + esc(b.subtitle) + '</span>';

        var links = (n.links || []).map(function (l) {
            var href = navLinkHref(content, l);
            var current = l.pageId && page && l.pageId === page.id;
            // An in-page anchor only works on the page that has it; from
            // anywhere else it has to go home first.
            if (href.charAt(0) === '#' && page && !page.home) href = global.SITE.pageUrl(home) + href;
            return '<li><a href="' + safeUrl(href) + '"' + (current ? ' class="is-current" aria-current="page"' : '') +
                   '>' + esc(l.label) + '</a></li>';
        }).join('');

        if (n.ctaText) {
            var ctaHref = navLinkHref(content, { pageId: n.ctaPageId, href: n.ctaLink });
            if (ctaHref.charAt(0) === '#' && page && !page.home) ctaHref = global.SITE.pageUrl(home) + ctaHref;
            links += '<li><a href="' + safeUrl(ctaHref) + '" class="nav-cta">' + esc(n.ctaText) + '</a></li>';
        }

        return '<a href="' + safeUrl(global.SITE.pageUrl(home)) + '" class="brand" id="brandNav">' +
                    emblem(content) + (text ? '<span class="brand-text">' + text + '</span>' : '') +
               '</a>' +
               '<ul class="nav-links" id="navLinks">' + links + '</ul>' +
               '<button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menu" aria-expanded="false">' +
                    '<i class="fas fa-bars"></i></button>';
    }

    /* =================================================================
       Footer
       ================================================================= */
    function socialsHTML(content, opts) {
        opts = opts || {};
        var extra = opts.className ? ' ' + opts.className : '';
        var style = opts.size ? ' style="width:' + px(opts.size, 46) + ';height:' + px(opts.size, 46) + ';"' : '';
        return (content.contact && content.contact.socials || []).map(function (s) {
            return '<a href="' + safeUrl(s.url) + '" class="social-link' + extra + '" title="' + esc(s.label) + '" ' +
                   'aria-label="' + esc(s.label) + '" target="_blank" rel="noopener"' + style + '>' +
                   '<i class="' + esc(s.icon || 'fas fa-link') + '"></i></a>';
        }).join('');
    }

    function footer(content, page) {
        var f = content.footer || {};
        var home = global.SITE.homePage(content);
        var backHref = (page && page.home) ? '#top' : global.SITE.pageUrl(home);

        // Pages that asked to appear in the menu get a tidy row of links.
        var pageLinks = (content.pages || []).filter(function (p) {
            return !p.home && p.showInNav !== false;
        }).map(function (p) {
            return '<a href="' + safeUrl(global.SITE.pageUrl(p)) + '">' + esc(p.title) + '</a>';
        }).join('');

        return (f.showEmblem === false ? '' : '<div id="footerEmblem">' + emblem(content) + '</div>') +
            '<div class="footer-tag">' + esc(f.tag1) + ' <span class="gold">' + esc(f.tag2) + '</span></div>' +
            '<div class="footer-values">' + esc((f.values || []).join(' · ')) + '</div>' +
            (pageLinks ? '<nav class="footer-pages" aria-label="Pages">' + pageLinks + '</nav>' : '') +
            '<div class="footer-socials">' + (f.showSocials === false ? '' : socialsHTML(content)) + '</div>' +
            '<div class="footer-divider"></div>' +
            '<p class="footer-meta">' + esc(f.meta1) + '</p>' +
            '<p class="footer-meta">' + esc(f.meta2) + ' · <a href="' + safeUrl(backHref) + '">Back to top</a></p>' +
            '<p class="footer-admin"><a href="/admin">Site admin</a></p>';
    }

    /* =================================================================
       ELEMENTS
       ================================================================= */
    var EL = {};

    EL.heading = function (e) {
        var level = /^h[1-6]$/.test(e.level) ? e.level : 'h2';
        var style = colourStyle(e.colour, e.customColour);
        return (e.kicker ? '<div class="section-label">' + esc(e.kicker) + '</div>' : '') +
            '<' + level + ' class="' + cls('hd', 'hd--' + (e.font || 'display'), 'hd--' + (e.size || 'lg')) + '"' +
            (style ? ' style="' + style + '"' : '') + '>' +
            titleHTML(e.text, e.accent) + '</' + level + '>';
    };

    EL.text = function (e) {
        var style = colourStyle(e.colour, e.customColour);
        if (e.columns && e.columns !== '1') style += 'column-count:' + esc(e.columns) + ';column-gap:2.4rem;';
        return '<div class="' + cls('rt', 'fs-' + (e.size || 'md')) + '"' +
               (style ? ' style="' + style + '"' : '') + '>' + safeHtml(e.html) + '</div>';
    };

    EL.image = function (e, ctx) {
        if (!e.src) {
            return ctx.edit ? '<div class="ed-empty"><i class="fas fa-image"></i> Choose a photo</div>' : '';
        }
        var imgStyle = 'border-radius:' + px(e.radius, 20) + ';' +
                       (e.ratio && e.ratio !== 'auto' ? 'aspect-ratio:' + esc(e.ratio) + ';object-fit:cover;' : '');
        var img = '<img src="' + safeUrl(e.src) + '" alt="' + esc(e.alt) + '" loading="lazy" style="' + imgStyle + '">';

        var inner = img;
        if (e.link && !ctx.edit) {
            inner = '<a href="' + safeUrl(e.link) + '">' + img + '</a>';
        } else if (e.lightbox !== false && !ctx.edit) {
            inner = '<button type="button" class="img-zoom" data-lb-src="' + safeUrl(e.src) + '" ' +
                    'data-lb-title="' + esc(e.alt) + '" data-lb-desc="' + esc(e.caption) + '" ' +
                    'aria-label="View this photo full size">' + img + '</button>';
        }

        return '<figure class="' + cls('el-img', e.shadow !== false ? 'has-shadow' : '') + '" ' +
               'style="width:' + numOr(e.width, 100) + '%;">' + inner +
               (e.caption ? '<figcaption>' + esc(e.caption) + '</figcaption>' : '') + '</figure>';
    };

    EL.buttons = function (e, ctx) {
        var size = 'btn--' + (e.size || 'md');
        var html = (e.list || []).filter(function (b) { return b && b.text; }).map(function (b) {
            var styleName = 'btn-' + (b.style || 'primary');
            return '<a href="' + safeUrl(b.link) + '" class="' + cls('btn', styleName, size) + '"' +
                   (b.newTab ? ' target="_blank" rel="noopener"' : '') + '>' +
                   iconHTML(b.icon) + '<span>' + esc(b.text) + '</span></a>';
        }).join('');
        if (!html && ctx.edit) return '<div class="ed-empty"><i class="fas fa-hand-pointer"></i> Add a button</div>';
        return '<div class="el-buttons">' + html + '</div>';
    };

    function shapeWrap(shape, size, inner, style) {
        if (!shape || shape === 'none') {
            return '<span class="icon-plain" style="font-size:' + px(size, 48) + ';' + (style || '') + '">' + inner + '</span>';
        }
        var box = numOr(size, 48) * 1.75;
        return '<span class="' + cls('icon-shape', 'icon-shape--' + shape) + '" style="width:' + box + 'px;height:' + box +
               'px;font-size:' + px(size, 48) + ';' + (style || '') + '">' + inner + '</span>';
    }

    EL.icon = function (e) {
        var style = colourStyle(e.colour, e.customColour);
        var inner = shapeWrap(e.shape, e.size, iconHTML(e.icon), style);
        return e.link ? '<a href="' + safeUrl(e.link) + '" class="icon-link">' + inner + '</a>' : inner;
    };

    EL.iconbox = function (e) {
        return '<div class="' + cls('iconbox', 'iconbox--' + (e.layout || 'top'), e.card ? 'iconbox--card' : '') + '">' +
            '<div class="iconbox-icon">' + shapeWrap(e.shape, 34, iconHTML(e.icon)) + '</div>' +
            '<div class="iconbox-body">' +
                (e.title ? '<h3>' + esc(e.title) + '</h3>' : '') +
                '<div class="rt">' + safeHtml(e.html) + '</div>' +
                (e.linkText ? '<a class="arrow-link" href="' + safeUrl(e.link) + '">' + esc(e.linkText) +
                              ' <i class="fas fa-arrow-right"></i></a>' : '') +
            '</div></div>';
    };

    EL.spacer = function (e, ctx) {
        return '<div class="el-spacer' + (ctx.edit ? ' ed-visible' : '') +
               '" style="height:' + px(e.height, 40) + ';"></div>';
    };

    EL.divider = function (e) {
        var colour = e.colour === 'custom' ? (e.customColour || '#D99A00')
                   : e.colour === 'ink'    ? 'var(--ink)'
                   : e.colour === 'muted'  ? 'var(--muted)'
                   : e.colour === 'cream'  ? 'var(--cream)'
                   : 'var(--gold-deep)';
        if (e.sprout) {
            return '<div class="sprout" style="--sprout-colour:' + esc(colour) + ';">' +
                   iconHTML(e.sproutIcon || 'fa-seedling') + '</div>';
        }
        var margin = e.align === 'left' ? '0 auto 0 0' : e.align === 'right' ? '0 0 0 auto' : '0 auto';
        var line = e.style === 'fade'
            ? 'background:linear-gradient(90deg,transparent,' + esc(colour) + ',transparent);height:' + px(e.thickness, 1) + ';'
            : 'border-top:' + px(e.thickness, 1) + ' ' + esc(e.style || 'solid') + ' ' + esc(colour) + ';';
        return '<hr class="el-divider" style="width:' + numOr(e.width, 100) + '%;margin:' + margin + ';' + line + '">';
    };

    /* Work out how to embed whatever video address was pasted in. */
    function videoEmbed(url) {
        var u = String(url || '').trim();
        if (!u) return null;
        var m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
        if (m) return { type: 'iframe', src: 'https://www.youtube-nocookie.com/embed/' + m[1] };
        m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (m) return { type: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] };
        if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { type: 'video', src: u };
        return null;
    }

    EL.video = function (e, ctx) {
        var v = videoEmbed(e.url);
        var box = 'aspect-ratio:' + esc(e.ratio || '16/9') + ';border-radius:' + px(e.radius, 20) + ';';
        if (!v) {
            return ctx.edit
                ? '<div class="ed-empty"><i class="fas fa-play"></i> Paste a YouTube, Vimeo or .mp4 link</div>' : '';
        }
        var inner = v.type === 'iframe'
            ? '<iframe src="' + safeUrl(v.src) + '" title="' + esc(e.caption || 'Video') + '" ' +
              'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
              'allowfullscreen loading="lazy"></iframe>'
            : '<video src="' + safeUrl(v.src) + '" controls preload="metadata"></video>';
        return '<figure class="el-video" style="' + box + '">' + inner + '</figure>' +
               (e.caption ? '<figcaption class="el-video-cap">' + esc(e.caption) + '</figcaption>' : '');
    };

    function photoTile(it, opts) {
        var ratio = opts.ratio && opts.ratio !== 'auto' ? 'aspect-ratio:' + esc(opts.ratio) + ';' : '';
        var radius = 'border-radius:' + px(opts.radius, 20) + ';';
        var overlay = (opts.captions !== false && (it.title || it.desc))
            ? '<span class="gallery-overlay"><h4>' + esc(it.title) + '</h4><p>' + esc(it.desc) + '</p></span>' : '';
        var img = '<img src="' + safeUrl(it.image) + '" alt="' + esc(it.title || '') + '" loading="lazy">';

        if (opts.lightbox === false || opts.edit) {
            return '<div class="gallery-item" style="' + ratio + radius + '">' + img + overlay + '</div>';
        }
        return '<button type="button" class="gallery-item" style="' + ratio + radius + '" ' +
               'data-lb-src="' + safeUrl(it.image) + '" data-lb-title="' + esc(it.title || '') + '" ' +
               'data-lb-desc="' + esc(it.desc || '') + '" aria-label="' + esc(it.title || 'Photo') + '">' +
               img + overlay + '</button>';
    }

    EL.gallery = function (e, ctx) {
        var photos = (e.list || []).filter(function (p) { return p && p.image; });
        if (!photos.length) {
            return ctx.edit ? '<div class="ed-empty"><i class="fas fa-images"></i> Add some photos</div>' : '';
        }
        var tiles = photos.map(function (it) {
            return photoTile(it, { ratio: e.ratio, radius: e.radius, captions: e.captions,
                                   lightbox: e.lightbox, edit: ctx.edit });
        }).join('');
        return '<div class="grid" style="--cols:' + esc(e.columns || '3') + ';gap:' + px(e.gap, 20) + ';">' +
               tiles + '</div>';
    };

    EL.cards = function (e, ctx) {
        var cards = (e.list || []);
        if (!cards.length) {
            return ctx.edit ? '<div class="ed-empty"><i class="fas fa-table-cells-large"></i> Add a card</div>' : '';
        }
        var html = cards.map(function (c) {
            return '<article class="' + cls('card', 'card--' + (e.style || 'light')) + '">' +
                (c.image ? '<div class="card-image" style="background-image:url(\'' + safeUrl(c.image) + '\')">' +
                           (c.tag ? '<span class="card-tag">' + esc(c.tag) + '</span>' : '') + '</div>' : '') +
                '<div class="card-body">' +
                    (c.title ? '<h3>' + esc(c.title) + '</h3>' : '') +
                    (c.text ? '<p>' + esc(c.text) + '</p>' : '') +
                    ((c.meta || c.btnText) ? '<div class="card-meta">' +
                        (c.meta ? '<span class="card-loc">' + iconHTML(c.metaIcon) + ' ' + esc(c.meta) + '</span>' : '<span></span>') +
                        (c.btnText ? '<a href="' + safeUrl(c.btnLink) + '" class="arrow-link">' + esc(c.btnText) +
                                     ' <i class="fas fa-arrow-right"></i></a>' : '') +
                    '</div>' : '') +
                '</div></article>';
        }).join('');
        return '<div class="grid" style="--cols:' + esc(e.columns || '3') + ';gap:1.8rem;">' + html + '</div>';
    };

    EL.list = function (e) {
        var rows = (e.list || []).map(function (it) {
            return '<li>' + iconHTML(it.icon || e.icon || 'fa-check', 'tick') +
                   '<span>' + esc(it.text) + '</span></li>';
        }).join('');
        return '<ul class="' + cls('el-list', 'fs-' + (e.size || 'md')) + '" ' +
               'style="--cols:' + esc(e.columns || '1') + ';">' + rows + '</ul>';
    };

    EL.quote = function (e) {
        var who = '';
        if (e.author || e.photo) {
            who = '<figcaption class="quote-by">' +
                (e.photo ? '<img src="' + safeUrl(e.photo) + '" alt="" loading="lazy">' : '') +
                '<span><strong>' + esc(e.author) + '</strong>' +
                (e.role ? '<em>' + esc(e.role) + '</em>' : '') + '</span></figcaption>';
        }
        return '<figure class="' + cls('quote', 'quote--' + (e.style || 'mark')) + '">' +
               '<blockquote>' + esc(e.text) + '</blockquote>' + who + '</figure>';
    };

    EL.stats = function (e) {
        var html = (e.list || []).map(function (s) {
            var target = String(s.number || '').replace(/[^0-9.]/g, '');
            return '<div class="stat">' +
                '<div class="stat-num"' + (e.countUp !== false && target ? ' data-count="' + esc(target) + '"' : '') + '>' +
                    esc(s.number) + '<span class="stat-suffix">' + esc(s.suffix) + '</span></div>' +
                '<div class="stat-label">' + esc(s.label) + '</div></div>';
        }).join('');
        return '<div class="grid stats" style="--cols:' + esc(e.columns || '3') + ';gap:1.5rem;">' + html + '</div>';
    };

    EL.accordion = function (e) {
        // <details> gives open/close, keyboard support and screen-reader
        // behaviour without a line of JavaScript.
        var html = (e.list || []).map(function (it, i) {
            var open = (e.openFirst !== false && i === 0) ? ' open' : '';
            return '<details class="acc"' + open + '><summary>' + esc(it.title) +
                   '<i class="fas fa-chevron-down"></i></summary>' +
                   '<div class="acc-body rt">' + safeHtml(it.html) + '</div></details>';
        }).join('');
        return '<div class="el-accordion">' + html + '</div>';
    };

    EL.socials = function (e, ctx) {
        var html = socialsHTML(ctx.content, { className: 'social-link--' + (e.style || 'dark'), size: e.size });
        if (!html && ctx.edit) {
            return '<div class="ed-empty"><i class="fas fa-share-nodes"></i> Add social links under Contact &amp; Socials</div>';
        }
        return '<div class="social-links">' + html + '</div>';
    };

    EL.emblem = function (e, ctx) {
        var size = numOr(e.size, 130);
        var style = 'width:' + size + 'px;height:' + size + 'px;max-width:100%;' +
                    (e.glow !== false ? 'filter:drop-shadow(0 12px 24px rgba(217,154,0,0.35));' : '');
        var mark = emblem(ctx.content, { style: style });
        return e.link ? '<a href="' + safeUrl(e.link) + '">' + mark + '</a>' : mark;
    };

    EL.contactinfo = function (e, ctx) {
        var c = ctx.content.contact || {};
        var plain = e.style === 'plain';
        var row = function (icon, inner) {
            return '<div class="contact-row' + (plain ? ' contact-row--plain' : '') + '">' +
                   '<div class="ci">' + iconHTML(icon) + '</div><span>' + inner + '</span></div>';
        };
        var out = '';
        if (e.showAddress !== false && c.address) out += row('fa-location-dot', esc(c.address));
        if (e.showEmail   !== false && c.email)   out += row('fa-envelope', '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
        if (e.showPhone   !== false && c.phone)   out += row('fa-phone', '<a href="tel:' + esc(String(c.phone).replace(/[^0-9+]/g, '')) + '">' + esc(c.phone) + '</a>');
        if (!out && ctx.edit) return '<div class="ed-empty"><i class="fas fa-address-book"></i> Fill these in under Contact &amp; Socials</div>';
        return out;
    };

    EL.map = function (e, ctx) {
        var q = e.query || (ctx.content.contact && ctx.content.contact.address) || '';
        if (!q) {
            return ctx.edit ? '<div class="ed-empty"><i class="fas fa-map-location-dot"></i> Type an address</div>' : '';
        }
        var src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
        return '<div class="el-map" style="height:' + px(e.height, 380) + ';border-radius:' + px(e.radius, 20) + ';">' +
               '<iframe src="' + esc(src) + '" title="Map of ' + esc(q) + '" loading="lazy" ' +
               'referrerpolicy="no-referrer-when-downgrade"></iframe></div>';
    };

    EL.html = function (e, ctx) {
        if (!e.html) {
            return ctx.edit ? '<div class="ed-empty"><i class="fas fa-code"></i> Paste your embed code</div>' : '';
        }
        // Deliberately unfiltered: this element exists so an administrator
        // can paste an embed code. Only they can reach it.
        return '<div class="el-html">' + e.html + '</div>';
    };

    EL.form = function (e, ctx) {
        return contactForm(ctx.content, {
            title: e.title, note: e.note, button: e.button, card: e.card !== false, edit: ctx.edit
        });
    };

    /* The one contact form, shared by the form element and the contact
       section so there is only ever one copy of this markup. */
    function contactForm(content, o) {
        var uid = 'cf' + Math.random().toString(36).slice(2, 7);
        return '<div class="' + cls('connect-form', o.card === false ? 'connect-form--plain' : '') + '">' +
            (o.title ? '<h4 class="form-title">' + esc(o.title) + '</h4>' : '') +
            (o.note ? '<p class="form-note">' + esc(o.note) + '</p>' : '') +
            '<form class="js-contact-form" novalidate' + (o.edit ? ' onsubmit="return false"' : '') + '>' +
                '<div class="form-group"><label for="' + uid + 'n">Your name</label>' +
                    '<input type="text" id="' + uid + 'n" name="name" placeholder="What should we call you?" required></div>' +
                '<div class="form-group"><label for="' + uid + 'e">Email address</label>' +
                    '<input type="email" id="' + uid + 'e" name="email" placeholder="you@uiowa.edu" required></div>' +
                '<div class="form-group"><label for="' + uid + 's">Subject <span class="opt">(optional)</span></label>' +
                    '<input type="text" id="' + uid + 's" name="subject" placeholder="What\'s this about?"></div>' +
                '<div class="form-group"><label for="' + uid + 'm">Message</label>' +
                    '<textarea id="' + uid + 'm" name="message" placeholder="Questions, prayer requests, or just saying hi..." required></textarea></div>' +
                // Spam trap: hidden from people, filled in by bots.
                '<div class="hp-field" aria-hidden="true"><label for="' + uid + 'w">Leave this empty</label>' +
                    '<input type="text" id="' + uid + 'w" name="website" tabindex="-1" autocomplete="off"></div>' +
                '<button type="submit" class="form-submit"><i class="fas fa-paper-plane"></i> ' +
                    esc(o.button || 'Send it') + '</button>' +
                '<div class="form-status" role="status" aria-live="polite"></div>' +
            '</form></div>';
    }

    /* One element, wrapped so the CMS can select it. */
    function renderElement(e, ctx) {
        var fn = EL[e.type];
        if (!fn) return '';
        var body = fn(e, ctx) || '';
        if (!body && !ctx.edit) return '';
        var align = e.align ? ' ' + alignClass(e.align) : '';
        return '<div class="' + cls('el', 'el--' + e.type, editClass(ctx, 'element', e.id)) + align + '"' +
               tag(ctx, 'element', e.id) + '>' +
               toolbar(ctx, 'element', e.id, B.elementLabel(e), { icon: (B.elements[e.type] || {}).icon }) +
               body + '</div>';
    }

    /* =================================================================
       Rows and columns — the free-form layout inside a blank section.
       ================================================================= */
    function columnStyle(c) {
        var s = 'flex:0 0 auto;width:' + numOr(c.width, 100) + '%;';
        switch (c.bg) {
            case 'paper':  s += 'background:var(--paper);'; break;
            case 'cream':  s += 'background:var(--cream);'; break;
            case 'ink':    s += 'background:var(--ink);'; break;
            case 'gold':   s += 'background:var(--gold);'; break;
            case 'custom': if (c.bgColor) s += 'background:' + esc(c.bgColor) + ';'; break;
        }
        if (c.bgImage) s += 'background-image:url(\'' + safeUrl(c.bgImage) + '\');background-size:cover;background-position:center;';
        if (numOr(c.pad, 0))    s += 'padding:' + px(c.pad, 0) + ';';
        if (numOr(c.radius, 0)) s += 'border-radius:' + px(c.radius, 0) + ';';
        if (c.border) s += 'border:1px solid var(--line);';
        if (c.shadow) s += 'box-shadow:0 20px 50px rgba(20,18,16,0.08);';
        if (c.valign === 'middle') s += 'display:flex;flex-direction:column;justify-content:center;';
        if (c.valign === 'bottom') s += 'display:flex;flex-direction:column;justify-content:flex-end;';
        return s;
    }

    function renderColumn(c, ctx, index) {
        var inner = (c.elements || []).map(function (e) { return renderElement(e, ctx); }).join('');
        if (!inner && ctx.edit) {
            inner = '<button type="button" class="ed-drop" data-act="add" data-kind="element" data-id="' +
                    esc(c.id) + '"><i class="fas fa-plus"></i> Add an element</button>';
        }
        return '<div class="' + cls('col', c.bg && c.bg !== 'none' ? 'col--filled' : '', editClass(ctx, 'column', c.id)) + '" ' +
               'style="' + columnStyle(c) + '"' + tag(ctx, 'column', c.id) + '>' +
               toolbar(ctx, 'column', c.id, 'Column ' + (index + 1),
                       { icon: 'fa-table-columns', buttons: ['add', 'up', 'down'] }) +
               inner + '</div>';
    }

    function renderRow(r, ctx, index) {
        var align = r.valign === 'top' ? 'flex-start' : r.valign === 'middle' ? 'center'
                  : r.valign === 'bottom' ? 'flex-end' : 'stretch';
        var style = 'gap:' + px(r.gap, 32) + ';align-items:' + align + ';' +
                    (numOr(r.padTop, 0) ? 'padding-top:' + px(r.padTop, 0) + ';' : '') +
                    (numOr(r.padBottom, 0) ? 'padding-bottom:' + px(r.padBottom, 0) + ';' : '');
        var cols = (r.columns || []).map(function (c, i) { return renderColumn(c, ctx, i); }).join('');
        return '<div class="' + cls('row', r.reverse ? 'row--reverse' : '', editClass(ctx, 'row', r.id)) + '" ' +
               'style="' + style + '"' + tag(ctx, 'row', r.id) + '>' +
               toolbar(ctx, 'row', r.id, 'Row ' + (index + 1),
                       { icon: 'fa-grip-lines', buttons: ['up', 'down', 'duplicate', 'delete'] }) +
               cols + '</div>';
    }

    /* =================================================================
       SECTIONS
       ================================================================= */
    var SEC = {};

    SEC.hero = function (s, ctx) {
        var h = s.data;
        var veil = 1;
        var photo = '';
        if (h.background === 'image' && h.bgImage) {
            veil = Math.min(100, Math.max(0, numOr(h.bgOverlay, 78))) / 100;
            photo = '<div class="hero-photo" style="background-image:url(\'' + safeUrl(h.bgImage) + '\')"></div>';
        }

        var values = (h.values || []).map(function (v, i) {
            return (i ? '<span class="dot">●</span>' : '') + '<span>' + esc(v) + '</span>';
        }).join('');

        var buttons = '';
        if (h.btn1Text) buttons += '<a href="' + safeUrl(h.btn1Link) + '" class="btn btn-primary">' +
                                   iconHTML(h.btn1Icon) + '<span>' + esc(h.btn1Text) + '</span></a>';
        if (h.btn2Text) buttons += '<a href="' + safeUrl(h.btn2Link) + '" class="btn btn-ghost">' +
                                   iconHTML(h.btn2Icon) + '<span>' + esc(h.btn2Text) + '</span></a>';

        return '<div class="hero-body" style="--veil:' + veil + ';">' +
            photo +
            '<div class="hero-veil"></div><div class="hero-dots"></div>' +
            '<div class="hero-inner">' +
                (h.showEmblem === false ? '' : emblem(ctx.content)) +
                (h.kicker ? '<div class="kicker">' + esc(h.kicker) + '</div>' : '') +
                '<div class="hero-title">' + esc(h.title) +
                    (h.titleSub ? '<span class="sub">' + esc(h.titleSub) + '</span>' : '') + '</div>' +
                '<h1><span class="line">' + esc(h.line1) + '</span>' +
                    '<span class="line gold">' + esc(h.line2) + '</span></h1>' +
                (h.sub ? '<p class="hero-sub">' + esc(h.sub) + '</p>' : '') +
                (values ? '<div class="value-strip">' + values + '</div>' : '') +
                (buttons ? '<div class="hero-buttons">' + buttons + '</div>' : '') +
            '</div>' +
            (h.showScene === false ? '' : SCENE_SVG) +
        '</div>';
    };

    SEC.pagehero = function (s, ctx) {
        var d = s.data;
        var dark = d.background === 'dark' || d.background === 'image';
        var bg = '';
        if (d.background === 'image' && d.bgImage) {
            bg = '<div class="ph-photo" style="background-image:url(\'' + safeUrl(d.bgImage) + '\')"></div>' +
                 '<div class="ph-veil" style="background:rgba(20,18,16,' + (numOr(d.bgOverlay, 55) / 100) + ');"></div>';
        }
        var home = global.SITE.homePage(ctx.content);
        var crumbs = (d.crumbs !== false && ctx.page && !ctx.page.home)
            ? '<nav class="ph-crumbs" aria-label="Breadcrumb"><a href="' + safeUrl(global.SITE.pageUrl(home)) + '">Home</a>' +
              '<i class="fas fa-chevron-right"></i><span>' + esc(ctx.page.title) + '</span></nav>' : '';

        return '<div class="' + cls('ph', 'ph--' + (d.height || 'md'), dark ? 'ph--dark' : '') + '">' + bg +
            '<div class="ph-inner ' + alignClass(d.align) + '">' +
                crumbs +
                (d.kicker ? '<div class="section-label">' + esc(d.kicker) + '</div>' : '') +
                '<h1 class="ph-title">' + titleHTML(d.title, d.titleAccent) + '</h1>' +
                (d.sub ? '<p class="ph-sub">' + esc(d.sub) + '</p>' : '') +
                (d.btnText ? '<div class="hero-buttons"><a href="' + safeUrl(d.btnLink) +
                             '" class="btn btn-primary"><span>' + esc(d.btnText) + '</span></a></div>' : '') +
            '</div></div>';
    };

    SEC.slider = function (s, ctx) {
        var d = s.data;
        var slides = (d.list || []);
        if (!slides.length) {
            return ctx.edit ? '<div class="ed-empty ed-empty--big"><i class="fas fa-sliders"></i> Add a slide</div>' : '';
        }
        var veil = numOr(d.overlay, 45) / 100;

        var items = slides.map(function (sl, i) {
            var buttons = '';
            if (sl.btnText)  buttons += '<a href="' + safeUrl(sl.btnLink) + '" class="btn btn-primary"><span>' + esc(sl.btnText) + '</span></a>';
            if (sl.btn2Text) buttons += '<a href="' + safeUrl(sl.btn2Link) + '" class="btn btn-light"><span>' + esc(sl.btn2Text) + '</span></a>';
            return '<div class="slide' + (i === 0 ? ' is-active' : '') + '" role="group" ' +
                   'aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + slides.length + '"' +
                   (sl.image ? ' style="background-image:url(\'' + safeUrl(sl.image) + '\')"' : '') + '>' +
                '<div class="slide-veil" style="background:rgba(20,18,16,' + veil + ');"></div>' +
                '<div class="slide-inner ' + alignClass(d.align) + '">' +
                    (sl.kicker ? '<div class="kicker">' + esc(sl.kicker) + '</div>' : '') +
                    '<h2 class="slide-title">' + esc(sl.title) + '</h2>' +
                    (sl.text ? '<p class="slide-text">' + esc(sl.text) + '</p>' : '') +
                    (buttons ? '<div class="hero-buttons">' + buttons + '</div>' : '') +
                '</div></div>';
        }).join('');

        var dots = d.dots !== false && slides.length > 1
            ? '<div class="slider-dots">' + slides.map(function (sl, i) {
                  return '<button type="button" class="slider-dot' + (i === 0 ? ' is-active' : '') +
                         '" data-go="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>';
              }).join('') + '</div>' : '';

        var arrows = d.arrows !== false && slides.length > 1
            ? '<button type="button" class="slider-arrow slider-prev" aria-label="Previous slide"><i class="fas fa-chevron-left"></i></button>' +
              '<button type="button" class="slider-arrow slider-next" aria-label="Next slide"><i class="fas fa-chevron-right"></i></button>' : '';

        return '<div class="' + cls('slider', 'slider--' + (d.height || 'lg'), 'slider--' + (d.effect || 'fade')) + '" ' +
               'data-slider="1" data-autoplay="' + (d.autoplay !== false && !ctx.edit ? '1' : '0') + '" ' +
               'data-interval="' + (numOr(d.interval, 6) * 1000) + '" aria-roledescription="carousel">' +
               '<div class="slides">' + items + '</div>' + arrows + dots + '</div>';
    };

    /* Header shared by the four "church" sections. */
    function sectionHead(d, opts) {
        opts = opts || {};
        var out = '';
        if (opts.sprout !== false) out += '<div class="sprout">' + iconHTML(opts.sproutIcon || 'fa-seedling') + '</div>';
        if (d.label) out += '<div class="section-label">' + esc(d.label) + '</div>';
        if (d.titleMain || d.titleAccent) out += '<h2 class="section-title">' + titleHTML(d.titleMain, d.titleAccent) + '</h2>';
        if (d.intro) out += '<p class="section-intro">' + esc(d.intro) + '</p>';
        return out;
    }

    SEC.vm = function (s) {
        var v = s.data;
        return sectionHead(v) +
            '<div class="vm-grid">' +
                '<div class="vm-card"><div class="icon-badge">' + iconHTML(v.visionIcon || 'fa-eye') + '</div><div>' +
                    '<h3>' + esc(v.visionTitle) + '</h3><p>' + esc(v.visionText) + '</p></div></div>' +
                '<div class="vm-card"><div class="icon-badge">' + iconHTML(v.missionIcon || 'fa-bullseye') + '</div><div>' +
                    '<h3>' + esc(v.missionTitle) + '</h3><p>' + esc(v.missionText) + '</p></div></div>' +
            '</div>';
    };

    SEC.impact = function (s, ctx) {
        var im = s.data;
        var areas = im.areas || [];
        // Exactly four arranges them around the emblem; any other number
        // falls back to a plain grid.
        var radial = areas.length === 4;
        var cards = areas.map(function (a, i) {
            var ga = radial ? ' style="grid-area:c' + (i + 1) + '"' : '';
            return '<div class="impact-card"' + ga + '>' +
                '<div class="ring">' + iconHTML(a.icon) + '</div>' +
                '<h3>' + esc(a.title) + '</h3><p>' + esc(a.text) + '</p></div>';
        });
        if (radial) {
            cards.splice(2, 0, '<div class="impact-mid" style="grid-area:mid">' + emblem(ctx.content) + '</div>');
        }
        return sectionHead(im) +
               '<div class="impact-grid ' + (radial ? 'radial' : 'flat') + '">' + cards.join('') + '</div>';
    };

    SEC.gather = function (s) {
        var g = s.data;
        var cards = (g.items || []).map(function (e) {
            return '<div class="event-card">' +
                '<div class="event-image" style="background-image:url(\'' + safeUrl(e.image) + '\')">' +
                    (e.tag ? '<span class="event-tag">' + esc(e.tag) + '</span>' : '') + '</div>' +
                '<div class="event-content">' +
                    (e.time ? '<div class="event-time"><i class="fas fa-clock"></i> ' + esc(e.time) + '</div>' : '') +
                    '<h3>' + esc(e.title) + '</h3><p>' + esc(e.desc) + '</p>' +
                    '<div class="event-meta">' +
                        '<span class="event-loc"><i class="fas fa-location-dot"></i> ' + esc(e.location) + '</span>' +
                        (e.btnText ? '<a href="' + safeUrl(e.btnLink) + '" class="event-rsvp">' + esc(e.btnText) +
                                     ' <i class="fas fa-arrow-right"></i></a>' : '') +
                    '</div>' +
                '</div></div>';
        }).join('');
        return sectionHead(g, { sproutIcon: 'fa-utensils' }) + '<div class="events-grid">' + cards + '</div>';
    };

    SEC.gallery = function (s, ctx) {
        var g = s.data;
        var strip = g.layout === 'strip';
        var tiles = (g.items || []).filter(function (p) { return p && p.image; }).map(function (it) {
            return photoTile(it, { ratio: strip ? 'auto' : '4/5', radius: 20, captions: true,
                                   lightbox: true, edit: ctx.edit });
        }).join('');
        return '<div class="wrap">' + sectionHead(g, { sproutIcon: 'fa-camera' }) + '</div>' +
            '<div class="' + (strip ? 'gallery-scroll' : 'gallery-grid') + '">' + tiles + '</div>' +
            '<p class="gallery-hint">' + (strip
                ? '<i class="fas fa-arrow-left"></i> Swipe to see more <i class="fas fa-arrow-right"></i>'
                : '<i class="fas fa-expand"></i> Tap any photo to view it full size') + '</p>';
    };

    SEC.connect = function (s, ctx) {
        var c = s.data;
        var info = '<div class="connect-info">' +
            (c.label ? '<div class="section-label ta-l">' + esc(c.label) + '</div>' : '') +
            '<h3>' + titleHTML(c.titleMain, c.titleAccent) + '</h3>' +
            (c.sub ? '<p>' + esc(c.sub) + '</p>' : '') +
            EL.contactinfo({ showAddress: true, showEmail: true, showPhone: true, style: 'tiles' }, ctx) +
            (c.showSocials === false ? '' : '<div class="social-links">' + socialsHTML(ctx.content) + '</div>') +
        '</div>';

        if (c.showForm === false) return '<div class="connect-grid connect-grid--one">' + info + '</div>';
        return '<div class="connect-grid">' + info +
               contactForm(ctx.content, { title: c.formTitle, note: c.formNote, card: true, edit: ctx.edit }) +
               '</div>';
    };

    SEC.blocks = function (s, ctx) {
        var rows = (s.data.rows || []).map(function (r, i) { return renderRow(r, ctx, i); }).join('');
        if (!rows && ctx.edit) {
            return '<button type="button" class="ed-drop ed-drop--row" data-act="add" data-kind="row" data-id="' +
                   esc(s.id) + '"><i class="fas fa-plus"></i> Add a row</button>';
        }
        return rows + (ctx.edit
            ? '<button type="button" class="ed-drop ed-drop--row" data-act="add" data-kind="row" data-id="' +
              esc(s.id) + '"><i class="fas fa-plus"></i> Add a row</button>' : '');
    };

    /* ---- the frame every section sits in ---- */
    function sectionStyle(s, def) {
        var st = s.style || {};
        var out = '';
        switch (st.bg) {
            case 'paper':  out += 'background-color:var(--paper);'; break;
            case 'cream2': out += 'background-color:var(--cream-2);'; break;
            case 'ink':    out += 'background-color:var(--ink);'; break;
            case 'gold':   out += 'background-color:var(--gold);'; break;
            case 'custom': out += 'background-color:' + esc(st.bgColor || '#FBF6E9') + ';'; break;
            case 'image':  break;   // handled by the photo layer below
            default:       out += 'background-color:var(--cream);';
        }
        if (!(def && def.fixedPad)) {
            out += 'padding-top:' + numOr(st.padTop, 6) + 'rem;padding-bottom:' + numOr(st.padBottom, 6) + 'rem;';
        }
        return out;
    }

    function wrapClass(width) {
        return width === 'full' ? 'wrap wrap--full'
             : width === 'narrow' ? 'wrap wrap--narrow'
             : width === 'mid' ? 'wrap wrap--mid' : 'wrap';
    }

    function renderSection(s, ctx, index, total) {
        var def = B.sections[s.type] || {};
        var fn = SEC[s.type];
        if (!fn) return '';
        if (!s.show && !ctx.edit) return '';

        var st = s.style || {};
        var body = fn(s, ctx) || '';

        // A section whose kind lays itself out edge-to-edge is not put in a
        // wrapper — it manages its own width.
        var selfWidth = (s.type === 'hero' || s.type === 'slider' || s.type === 'pagehero' || s.type === 'gallery');
        var inner = selfWidth ? body : '<div class="' + wrapClass(st.width) + '">' + body + '</div>';

        var photo = '';
        if (st.bg === 'image' && st.bgImage) {
            photo = '<div class="sec-photo" style="background-image:url(\'' + safeUrl(st.bgImage) + '\');' +
                    (st.bgFixed ? 'background-attachment:fixed;' : '') + '"></div>' +
                    '<div class="sec-veil" style="background:rgba(20,18,16,' + (numOr(st.bgOverlay, 45) / 100) + ');"></div>';
        }

        var dark = st.bg === 'ink' || st.bg === 'image';
        var animate = st.animate !== false && !ctx.edit;

        return '<section class="' + cls('sec', 'sec--' + s.type, dark ? 'sec--dark' : '',
                                        st.bg === 'gold' ? 'sec--gold' : '',
                                        st.width === 'full' ? 'sec--flush' : '',
                                        photo ? 'sec--photo' : '',
                                        animate ? 'reveal' : '',
                                        !s.show ? 'is-hidden' : '',
                                        editClass(ctx, 'section', s.id)) + '"' +
               (st.anchor ? ' id="' + esc(st.anchor) + '"' : '') +
               ' style="' + sectionStyle(s, def) + '"' + tag(ctx, 'section', s.id) + '>' +
            photo +
            (ctx.edit ? sectionBar(ctx, s, def, index, total) : '') +
            inner +
        '</section>';
    }

    /* The section's own toolbar carries a couple of extras the generic one
       does not: a hide switch and "add a section after this one". */
    function sectionBar(ctx, s, def, index, total) {
        var btn = function (act, icon, title, extra) {
            return '<button type="button" class="ed-btn' + (extra || '') + '" data-act="' + act +
                   '" data-kind="section" data-id="' + esc(s.id) + '" title="' + esc(title) +
                   '" aria-label="' + esc(title) + '"><i class="fas ' + icon + '"></i></button>';
        };
        return '<div class="ed-bar ed-bar--section">' +
            '<span class="ed-tag" data-act="select" data-kind="section" data-id="' + esc(s.id) + '">' +
                '<i class="fas ' + esc(def.icon || 'fa-square') + '"></i> ' + esc(B.sectionLabel(s)) +
                (!s.show ? ' <em>(hidden)</em>' : '') + '</span>' +
            (index > 0 ? btn('up', 'fa-arrow-up', 'Move up') : '') +
            (index < total - 1 ? btn('down', 'fa-arrow-down', 'Move down') : '') +
            btn('toggle', s.show ? 'fa-eye' : 'fa-eye-slash', s.show ? 'Hide this section' : 'Show this section') +
            btn('duplicate', 'fa-clone', 'Make a copy') +
            btn('delete', 'fa-trash', 'Delete') +
            btn('addafter', 'fa-plus', 'Add a section after this one', ' ed-btn--primary') +
        '</div>';
    }

    /* =================================================================
       A whole page
       ================================================================= */
    function page(content, pg, opts) {
        opts = opts || {};
        var ctx = { content: content, page: pg, edit: !!opts.edit, selected: opts.selected || null };
        if (!pg) return '<section class="sec"><div class="wrap"><p>This page could not be found.</p></div></section>';

        var sections = pg.sections || [];
        var html = sections.map(function (s, i) { return renderSection(s, ctx, i, sections.length); }).join('');

        if (ctx.edit) {
            html += '<button type="button" class="ed-addsection" data-act="addend" data-kind="section" data-id="">' +
                    '<i class="fas fa-plus"></i> Add a section</button>';
        } else if (!html) {
            html = '<section class="sec" style="padding:8rem 2rem;"><div class="wrap ta-c">' +
                   '<p class="section-intro">This page has no content yet.</p></div></section>';
        }
        return html;
    }

    /* =================================================================
       Behaviour that needs JavaScript: slideshows, counters, reveals.
       Called after the HTML has been put on the page.
       ================================================================= */
    function activate(root, opts) {
        opts = opts || {};
        root = root || document;

        /* ---- slideshows ---- */
        root.querySelectorAll('[data-slider]').forEach(function (el) {
            if (el._sliderOn) return;
            el._sliderOn = true;

            var slides = Array.prototype.slice.call(el.querySelectorAll('.slide'));
            var dots   = Array.prototype.slice.call(el.querySelectorAll('.slider-dot'));
            if (slides.length < 2) return;
            var i = 0, timer = null;

            function paint() {
                slides.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
                dots.forEach(function (d, n) {
                    d.classList.toggle('is-active', n === i);
                    d.setAttribute('aria-current', n === i ? 'true' : 'false');
                });
            }
            function go(n) { i = (n + slides.length) % slides.length; paint(); restart(); }
            function restart() {
                if (timer) clearInterval(timer);
                if (el.dataset.autoplay === '1') {
                    timer = setInterval(function () { go(i + 1); }, Math.max(2000, Number(el.dataset.interval) || 6000));
                }
            }

            var prev = el.querySelector('.slider-prev');
            var next = el.querySelector('.slider-next');
            if (prev) prev.addEventListener('click', function () { go(i - 1); });
            if (next) next.addEventListener('click', function () { go(i + 1); });
            dots.forEach(function (d) {
                d.addEventListener('click', function () { go(Number(d.dataset.go) || 0); });
            });
            // Stop moving while someone is reading it.
            el.addEventListener('mouseenter', function () { if (timer) clearInterval(timer); });
            el.addEventListener('mouseleave', restart);
            restart();
        });

        /* ---- numbers that count up ---- */
        var counters = Array.prototype.slice.call(root.querySelectorAll('.stat-num[data-count]'));
        if (counters.length && 'IntersectionObserver' in global) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    io.unobserve(entry.target);
                    countUp(entry.target);
                });
            }, { threshold: 0.4 });
            counters.forEach(function (c) { io.observe(c); });
        }

        /* ---- fade sections in as they scroll into view ---- */
        if (!opts.edit) revealOn(root);
    }

    function countUp(el) {
        var target = parseFloat(el.dataset.count);
        if (!isFinite(target)) return;
        var suffix = el.querySelector('.stat-suffix');
        var suffixHTML = suffix ? suffix.outerHTML : '';
        var decimals = (String(el.dataset.count).split('.')[1] || '').length;
        var start = null, dur = 1200;

        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min(1, (ts - start) / dur);
            // Ease out, so it slows as it arrives.
            var value = target * (1 - Math.pow(1 - p, 3));
            el.innerHTML = value.toFixed(decimals) + suffixHTML;
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    var revealObserver = null;
    function revealOn(root) {
        if (!('IntersectionObserver' in global)) {
            (root || document).querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
            return;
        }
        if (!revealObserver) {
            revealObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        revealObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        }
        (root || document).querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
            revealObserver.observe(el);
        });
    }

    /* =================================================================
       The editing canvas: clicking anything tells the CMS what it was.
       ================================================================= */
    function editRuntime(root, send) {
        root = root || document;
        if (root._editOn) return;
        root._editOn = true;

        root.addEventListener('click', function (ev) {
            var btn = ev.target.closest('[data-act]');
            if (btn) {
                ev.preventDefault();
                ev.stopPropagation();
                send({
                    type: 'wesley-edit',
                    action: btn.dataset.act,
                    kind: btn.dataset.kind,
                    id: btn.dataset.id
                });
                return;
            }

            // Links must not navigate away from the canvas mid-edit.
            var link = ev.target.closest('a');
            if (link) ev.preventDefault();

            var node = ev.target.closest('[data-ed]');
            if (!node) return;
            ev.preventDefault();
            send({ type: 'wesley-edit', action: 'select', kind: node.dataset.kind, id: node.dataset.id });
        }, true);

        // Hovering highlights the innermost thing under the pointer only,
        // otherwise every ancestor lights up at once.
        root.addEventListener('mouseover', function (ev) {
            root.querySelectorAll('.is-hover').forEach(function (n) { n.classList.remove('is-hover'); });
            var node = ev.target.closest('[data-ed]');
            if (node) node.classList.add('is-hover');
        });
        root.addEventListener('mouseleave', function () {
            root.querySelectorAll('.is-hover').forEach(function (n) { n.classList.remove('is-hover'); });
        }, true);
    }

    /* The illustrated skyline along the bottom of the hero. */
    var SCENE_SVG =
        '<div class="scene" aria-hidden="true"><svg viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax meet">' +
        '<g fill="#d9cfb6" opacity="0.75">' +
        '<rect x="470" y="120" width="34" height="120"/><rect x="510" y="90" width="40" height="150"/>' +
        '<rect x="556" y="140" width="26" height="100"/><rect x="588" y="70" width="30" height="170"/>' +
        '<rect x="624" y="110" width="46" height="130"/><rect x="676" y="150" width="24" height="90"/>' +
        '<rect x="706" y="96" width="38" height="144"/><rect x="750" y="130" width="30" height="110"/>' +
        '<rect x="786" y="60" width="26" height="180"/><rect x="818" y="120" width="42" height="120"/>' +
        '<rect x="866" y="150" width="28" height="90"/></g>' +
        '<g fill="#c7b89a" opacity="0.9"><rect x="600" y="120" width="18" height="8"/>' +
        '<rect x="792" y="86" width="14" height="8"/><rect x="796" y="60" width="6" height="14"/></g>' +
        '<path d="M0 220 Q300 200 600 214 T1200 210 L1200 260 L0 260 Z" fill="#141210"/>' +
        '<path d="M40 260 C160 235 150 210 320 208 C470 206 470 224 600 218 C720 213 720 205 820 206 L900 206 L860 260 L560 260 C560 260 470 240 380 244 C260 249 240 260 120 260 Z" fill="#F2B705"/>' +
        '<path d="M300 214 C420 210 470 224 600 219" fill="none" stroke="#141210" stroke-width="2" stroke-dasharray="10 12" opacity="0.35"/>' +
        '<path d="M980 260 C1010 200 1080 190 1120 200 C1170 212 1200 210 1200 210 L1200 260 Z" fill="#141210"/>' +
        '<g fill="#141210"><circle cx="1030" cy="196" r="20"/><rect x="1027" y="196" width="6" height="26"/>' +
        '<circle cx="1075" cy="184" r="26"/><rect x="1071" y="184" width="8" height="34"/>' +
        '<circle cx="1120" cy="198" r="18"/><rect x="1117" y="198" width="6" height="24"/></g>' +
        '<g fill="#141210">' +
        '<g transform="translate(70 168)"><circle cx="0" cy="0" r="9"/><path d="M-9 12 Q0 8 9 12 L11 52 L4 52 L2 30 L-2 30 L-4 52 L-11 52 Z"/><rect x="-16" y="14" width="8" height="24" rx="3"/></g>' +
        '<g transform="translate(108 174)"><circle cx="0" cy="0" r="8"/><path d="M-8 11 Q0 7 8 11 L10 48 L4 48 L2 28 L-2 28 L-4 48 L-10 48 Z"/></g>' +
        '<g transform="translate(146 170)"><circle cx="0" cy="0" r="9"/><path d="M-9 12 Q0 8 9 12 L11 50 L4 50 L2 29 L-2 29 L-4 50 L-11 50 Z"/><rect x="9" y="14" width="8" height="22" rx="3"/></g>' +
        '<g transform="translate(184 176)"><circle cx="0" cy="0" r="8"/><path d="M-8 11 Q0 7 8 11 L10 46 L4 46 L2 27 L-2 27 L-4 46 L-10 46 Z"/></g>' +
        '</g></svg></div>';

    global.RENDER = {
        page: page,
        nav: nav,
        footer: footer,
        emblem: emblem,
        socials: socialsHTML,
        activate: activate,
        reveal: revealOn,
        editRuntime: editRuntime,
        esc: esc,
        safeUrl: safeUrl
    };
})(window);
