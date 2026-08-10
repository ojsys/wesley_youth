/* =====================================================================
   Shared content model for the First UMC & Wesley Foundation website.

   Loaded by BOTH index.html (the public site) and admin.html (the CMS), so
   the two can never drift apart. Everything an admin can edit lives here.

   The site is a list of PAGES. Each page is a list of SECTIONS. A section
   is either one of the ready-made kinds (a hero, a gallery, the gatherings
   grid…) or a blank one built out of ROWS -> COLUMNS -> ELEMENTS. The kinds
   themselves, and the settings each one offers, are described in blocks.js.

       content
         brand      logo, name, tab title            (site-wide)
         nav        the menu across the top          (site-wide)
         contact    address, email, phone, socials   (site-wide)
         footer     the bottom of every page         (site-wide)
         pages[]    id, title, slug, seo, sections[]

   Exposes:
     SITE.defaults()        the built-in starting content
     SITE.socialPresets     the social networks offered in the CMS
     SITE.clone(obj)
     SITE.merge(base, over)
     SITE.normalise(obj)    fills in missing keys + upgrades older saved data
     SITE.slugify(text)
     SITE.homePage(content)
     SITE.pageBySlug(content, slug)
     SITE.pageById(content, id)
     SITE.newPage(title)
     SITE.pageUrl(page)
   ===================================================================== */
(function (global) {
    'use strict';

    var B = global.BLOCKS;

    /* Site-wide things that are not part of any one page. */
    var SITE_DEFAULTS = {
        version: 2,

        brand: {
            logoImage: '',
            favicon: '',            // browser tab icon; falls back to the logo, then the built-in emblem
            navLogoSize: 62,        // height of the logo in the top bar, in pixels
                                    // (the bar is a fixed 70px, so 62 is the ceiling)
            navLogoMaxWidth: 240,   // how broad a wide logo may run in the top bar
            logoScale: 100,         // size of the logo everywhere else, as a % of normal
            showTitle: true,        // the church name beside the logo, top of the page
            showSubtitle: true,     // the small line under it
            titleFull: 'First United Methodist Church & Wesley Foundation',
            subtitle: 'Campus Ministry · Iowa City',
            browserTitle: 'First United Methodist Church & Wesley Foundation — Iowa City'
        },

        nav: {
            links: [
                { id: '', label: 'Vision',     href: '#vision' },
                { id: '', label: 'Impact',     href: '#impact' },
                { id: '', label: 'Gatherings', href: '#gather' },
                { id: '', label: 'Gallery',    href: '#gallery' }
            ],
            ctaText: 'Join Us',
            ctaLink: '#connect'
        },

        /* Typed once, used by the contact section, the footer, and the
           address / social-link elements wherever they appear. */
        contact: {
            address: '120 N. Dubuque Street, Iowa City, IA',
            email: 'wesley@icfirstchurch.org',
            phone: '(319) 337-2021',
            socials: [
                { id: '', label: 'Facebook',  icon: 'fab fa-facebook-f', url: 'https://facebook.com/' },
                { id: '', label: 'Instagram', icon: 'fab fa-instagram',  url: 'https://instagram.com/' },
                { id: '', label: 'YouTube',   icon: 'fab fa-youtube',    url: 'https://youtube.com/' }
            ]
        },

        footer: {
            tag1: 'Grace for Today.',
            tag2: 'Impact for Tomorrow.',
            values: ['Belong', 'Grow', 'Lead', 'Serve'],
            meta1: 'First United Methodist Church & Wesley Foundation · Campus Ministry, Iowa City',
            meta2: 'Disciples of Jesus Christ for the transformation of the world.',
            showSocials: true,
            showEmblem: true
        },

        pages: []   // filled in by defaults() below
    };

    /* Networks offered by the "Add a social" picker in the CMS. */
    var SOCIAL_PRESETS = [
        { label: 'Facebook',  icon: 'fab fa-facebook-f', url: 'https://facebook.com/' },
        { label: 'Instagram', icon: 'fab fa-instagram',  url: 'https://instagram.com/' },
        { label: 'YouTube',   icon: 'fab fa-youtube',    url: 'https://youtube.com/' },
        { label: 'TikTok',    icon: 'fab fa-tiktok',     url: 'https://tiktok.com/@' },
        { label: 'X',         icon: 'fab fa-x-twitter',  url: 'https://x.com/' },
        { label: 'LinkedIn',  icon: 'fab fa-linkedin-in',url: 'https://linkedin.com/company/' },
        { label: 'WhatsApp',  icon: 'fab fa-whatsapp',   url: 'https://wa.me/' },
        { label: 'GroupMe',   icon: 'fas fa-comments',   url: 'https://groupme.com/' },
        { label: 'Spotify',   icon: 'fab fa-spotify',    url: 'https://open.spotify.com/' },
        { label: 'Email',     icon: 'fas fa-envelope',   url: 'mailto:' },
        { label: 'Website',   icon: 'fas fa-globe',      url: 'https://' }
    ];

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    function merge(base, over) {
        for (var k in over) {
            if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
            var v = over[k];
            if (v && typeof v === 'object' && !Array.isArray(v) &&
                base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
                merge(base[k], v);
            } else if (v !== undefined) {
                base[k] = v;
            }
        }
        return base;
    }

    /* ---------------------------------------------------------------
       Slugs — the bit of the address that names a page.
       --------------------------------------------------------------- */
    function slugify(s) {
        return String(s == null ? '' : s)
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
    }

    /* Make `slug` unique among the other pages. */
    function uniqueSlug(pages, slug, exceptId) {
        var base = slug || 'page';
        var candidate = base;
        var n = 2;
        var taken = function (s) {
            return pages.some(function (p) { return p.id !== exceptId && p.slug === s; });
        };
        while (taken(candidate)) { candidate = base + '-' + n; n += 1; }
        return candidate;
    }

    /* ---------------------------------------------------------------
       The starting site: one home page made of the six original
       sections, in their original order and with their original look.
       --------------------------------------------------------------- */
    function defaultHomeSections() {
        var anchors = { hero: 'top', vm: 'vision', impact: 'impact',
                        gather: 'gather', gallery: 'gallery', connect: 'connect' };
        return ['hero', 'vm', 'impact', 'gather', 'gallery', 'connect'].map(function (type) {
            var s = B.newSection(type);
            s.style.anchor = anchors[type];
            return s;
        });
    }

    function newPage(title, opts) {
        opts = opts || {};
        return {
            id: B.uid(),
            title: title || 'New page',
            slug: opts.slug !== undefined ? opts.slug : slugify(title || 'new-page'),
            home: opts.home === true,
            showInNav: opts.showInNav !== false,
            seo: { title: '', description: '', image: '' },
            sections: opts.sections || []
        };
    }

    /* ---------------------------------------------------------------
       The two pages every church site needs beyond the home page.

       They are built here rather than typed into the CMS so that a fresh
       install and an upgrade from the old one-page site both end up with
       them, already filled in and ready to be edited like anything else.
       --------------------------------------------------------------- */

    /* Small builders, so the page definitions below read like the pages
       they describe rather than like object literals. */
    function el(type, over) { return B.newElement(type, over); }

    function row(layoutKey, columns, over) {
        var r = B.newRow(layoutKey);
        r.columns.forEach(function (c, i) { c.elements = columns[i] || []; });
        if (over) merge(r, over);
        return r;
    }

    /* `name` is what the section is called in the CMS outline — without it
       a page of blank sections all read "Blank section". */
    function blocks(name, style, rows) {
        var s = B.newSection('blocks');
        s.name = name || '';
        if (style) merge(s.style, style);
        s.data.rows = rows;
        return s;
    }

    function header(opts) {
        var s = B.newSection('pagehero');
        merge(s.data, opts);
        return s;
    }

    function aboutPage() {
        var p = newPage('About', { slug: 'about' });

        p.sections = [
            header({
                kicker: 'Who We Are',
                title: 'About', titleAccent: 'Us',
                sub: 'A church and a campus ministry sharing one roof in the heart of downtown Iowa City.',
                height: 'md', align: 'center', crumbs: true
            }),

            /* The story, beside a photo. */
            blocks('Our story', { bg: 'cream', padTop: 6, padBottom: 6 }, [
                row('1-1', [
                    [
                        el('heading', { kicker: 'Our Story', text: 'Faith at the heart of',
                                        accent: 'campus', size: 'lg', align: 'left' }),
                        el('text', {
                            html: '<p>First United Methodist Church has been part of downtown Iowa City for ' +
                                  'generations, and the Wesley Foundation has walked alongside University of ' +
                                  'Iowa students for just as long. Today we are one community: neighbours and ' +
                                  'students, lifelong members and people stepping into a church for the very ' +
                                  'first time.</p>' +
                                  '<p>We are not interested in pretending. We are interested in grace — the ' +
                                  'kind that meets you where you actually are, on the week everything is going ' +
                                  'well and on the week none of it is.</p>'
                        }),
                        el('buttons', {
                            align: 'left',
                            list: [{ id: B.uid(), text: 'Come and see', link: '/contact',
                                     style: 'primary', icon: 'fa-arrow-right', newTab: false }]
                        })
                    ],
                    [el('image', {
                        // A stand-in, in the same spirit as the sample photos
                        // elsewhere, so the page looks finished from day one.
                        // Swap it for a real one in the editor.
                        src: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1000&h=750&fit=crop',
                        alt: 'Students and church members together',
                        ratio: '4/3', radius: 20, shadow: true, lightbox: false
                    })]
                ], { valign: 'middle' })
            ]),

            /* What a first visit is actually like. */
            blocks('What to expect', { bg: 'paper', padTop: 6, padBottom: 6 }, [
                row('1', [[
                    el('heading', { kicker: 'What To Expect', text: 'Your first', accent: 'visit',
                                    size: 'lg', align: 'center' }),
                    el('text', {
                        align: 'center',
                        html: '<p>No dress code, no sign-up sheet, and nobody will put you on the spot.</p>'
                    })
                ]]),
                row('1-1-1', [
                    [el('iconbox', {
                        icon: 'fa-people-group', title: 'Come as you are', shape: 'ring', card: true,
                        html: '<p>Jeans are fine. Doubts are fine. Arriving late because parking downtown ' +
                              'is what it is — also fine.</p>'
                    })],
                    [el('iconbox', {
                        icon: 'fa-utensils', title: 'Eat with us', shape: 'ring', card: true,
                        html: '<p>Dinner on Wednesdays is free and there is always enough. Bring a friend, ' +
                              'or come on your own and leave with a few.</p>'
                    })],
                    [el('iconbox', {
                        icon: 'fa-comments', title: 'Ask anything', shape: 'ring', card: true,
                        html: '<p>Hard questions are welcome here. You will not be handed a tidy answer ' +
                              'and sent on your way.</p>'
                    })]
                ], { gap: 28 })
            ]),

            /* Questions people actually ask before turning up. */
            blocks('Questions people ask', { bg: 'cream', width: 'mid', padTop: 6, padBottom: 6 }, [
                row('1', [[
                    el('heading', { text: 'Questions people', accent: 'ask', size: 'lg', align: 'center' }),
                    el('accordion', {
                        openFirst: true,
                        list: [
                            { id: B.uid(), title: 'Do I have to be a student?',
                              html: '<p>Not at all. The Wesley Foundation is our campus ministry, but First ' +
                                    'UMC is a church for the whole neighbourhood — students, families, ' +
                                    'staff, and anyone who wants to be here.</p>' },
                            { id: B.uid(), title: 'What should I wear?',
                              html: '<p>Whatever you own. You will see everything from suits to hoodies on ' +
                                    'a Sunday morning, and nobody is counting.</p>' },
                            { id: B.uid(), title: 'I am not sure what I believe.',
                              html: '<p>Then you are in good company. Plenty of people here are working ' +
                                    'things out, and you are not required to have it settled before you ' +
                                    'walk through the door.</p>' },
                            { id: B.uid(), title: 'Where do I park?',
                              html: '<p>There is street parking around the building and several ramps a ' +
                                    'short walk away. On Sunday mornings downtown parking is usually easy.</p>' },
                            { id: B.uid(), title: 'Is the building accessible?',
                              html: '<p>Yes. If there is anything we can do to make your visit easier, ' +
                                    'please just ask — we would much rather you told us.</p>' }
                        ]
                    })
                ]])
            ]),

            /* A closing invitation. */
            blocks('Invitation', { bg: 'ink', padTop: 4, padBottom: 4 }, [
                row('1', [[
                    el('heading', { text: 'There is a place for you here',
                                    size: 'xl', align: 'center', colour: 'cream' }),
                    el('text', {
                        align: 'center', colour: 'cream',
                        html: '<p>Come for dinner on Wednesday, or just send us a message first. ' +
                              'Either way, we would love to meet you.</p>'
                    }),
                    el('buttons', {
                        align: 'center',
                        list: [
                            { id: B.uid(), text: 'Get in touch', link: '/contact',
                              style: 'primary', icon: 'fa-paper-plane', newTab: false },
                            { id: B.uid(), text: "See what's on", link: '/#gather',
                              style: 'light', icon: '', newTab: false }
                        ]
                    })
                ]])
            ])
        ];

        p.seo.description = 'First United Methodist Church & Wesley Foundation in Iowa City — a church ' +
                            'and campus ministry where everyone is welcome, whatever you believe.';
        return p;
    }

    function contactPage() {
        var p = newPage('Contact', { slug: 'contact' });

        p.sections = [
            header({
                kicker: 'Say Hello',
                title: 'Get in', titleAccent: 'touch',
                sub: 'Questions, prayer requests, or just wondering where the free food is — we would love to hear from you.',
                height: 'sm', align: 'center', crumbs: true
            }),

            /* The real contact section: address, phone, socials and the form,
               all reading from the site-wide contact details. */
            (function () {
                var s = B.newSection('connect');
                merge(s.data, {
                    label: 'Reach Out',
                    titleMain: 'Send us a', titleAccent: 'message',
                    sub: 'We are a small team, so you will get a real person rather than an auto-reply. ' +
                         'We usually answer within a day or two.',
                    formTitle: 'Send us a message',
                    formNote: 'Your details stay with us — no lists, no spam.'
                });
                s.style.anchor = 'message';
                return s;
            })(),

            /* Where to find us, beside a map. */
            blocks('Where to find us', { bg: 'cream', padTop: 6, padBottom: 6 }, [
                row('1', [[
                    el('heading', { kicker: 'Finding Us', text: 'Where to', accent: 'find us',
                                    size: 'lg', align: 'center' })
                ]]),
                row('1-1', [
                    [el('map', { query: '', height: 400, radius: 20 })],
                    [
                        // No address block here on purpose: the contact section
                        // above already carries it, and repeating it twice on
                        // one page just reads as a mistake.
                        el('heading', { text: 'Getting here', size: 'sm', font: 'heading', align: 'left' }),
                        el('text', {
                            html: '<p><strong>Parking.</strong> There is street parking around the building, ' +
                                  'and several ramps within a short walk. Sunday mornings downtown are ' +
                                  'usually quiet.</p>' +
                                  '<p><strong>Accessibility.</strong> The building is accessible. If there is ' +
                                  'anything that would make your visit easier, please ask — we would rather ' +
                                  'know.</p>' +
                                  '<p><strong>Coming by bus.</strong> Several city and Cambus routes stop ' +
                                  'within a couple of blocks of the church.</p>'
                        })
                    ]
                ], { valign: 'top', gap: 40 })
            ]),

            /* When things happen. */
            blocks('When we gather', { bg: 'paper', padTop: 6, padBottom: 6 }, [
                row('1', [[
                    el('heading', { text: 'When we', accent: 'gather', size: 'lg', align: 'center' })
                ]]),
                row('1', [[
                    el('cards', {
                        columns: '3', style: 'light',
                        list: [
                            { id: B.uid(), image: '', tag: 'Every Sunday', title: 'Sunday Worship',
                              text: 'Music, a message, and a community that actually asks how you are doing.',
                              meta: '8:30 & 10:30 AM', metaIcon: 'fa-clock', btnText: '', btnLink: '#' },
                            { id: B.uid(), image: '', tag: 'Every Wednesday', title: 'Wednesday Dinner',
                              text: 'A free meal and honest conversation. Show up hungry.',
                              meta: '6:30 PM', metaIcon: 'fa-clock', btnText: '', btnLink: '#' },
                            { id: B.uid(), image: '', tag: 'Weekdays', title: 'Church Office',
                              text: 'Call or email and someone will get back to you.',
                              meta: 'Mon–Thu, 9 AM – 3 PM', metaIcon: 'fa-clock', btnText: '', btnLink: '#' }
                        ]
                    })
                ]])
            ])
        ];

        p.seo.description = 'Get in touch with First United Methodist Church & Wesley Foundation, ' +
                            'Iowa City — address, phone, service times and a message form.';
        return p;
    }

    /* Home, About and Contact, with the menu wired up to the last two. */
    function standardPages(homeSections) {
        var home = newPage('Home', { slug: '', home: true, showInNav: false });
        home.sections = homeSections;
        return [home, aboutPage(), contactPage()];
    }

    /* Point the top menu at a page, unless it already links there. */
    function addNavLink(nav, page) {
        if (!nav || !page) return;
        if (!Array.isArray(nav.links)) nav.links = [];
        var already = nav.links.some(function (l) {
            return l && (l.pageId === page.id ||
                         String(l.href || '').replace(/^\//, '') === page.slug);
        });
        if (already) return;
        nav.links.push({ id: B.uid(), label: page.title, href: '/' + page.slug, pageId: page.id });
    }

    function defaults() {
        var c = clone(SITE_DEFAULTS);
        c.pages = standardPages(defaultHomeSections());
        addNavLink(c.nav, c.pages[1]);
        addNavLink(c.nav, c.pages[2]);
        return c;
    }

    /* ---------------------------------------------------------------
       Upgrading content saved by the one-page version of the site.

       Back then the six sections were fixed top-level keys. Each becomes
       a section of the matching kind on a page called Home, so the site
       looks exactly as it did but every part of it can now be moved,
       copied, hidden or removed.
       --------------------------------------------------------------- */
    function migrateV1(saved) {
        var order = [
            { type: 'hero',    key: 'hero',    anchor: 'top' },
            { type: 'vm',      key: 'vm',      anchor: 'vision' },
            { type: 'impact',  key: 'impact',  anchor: 'impact' },
            { type: 'gather',  key: 'gather',  anchor: 'gather' },
            { type: 'gallery', key: 'gallery', anchor: 'gallery' },
            { type: 'connect', key: 'connect', anchor: 'connect' }
        ];

        var sections = order.map(function (spec) {
            var s = B.newSection(spec.type);
            var old = saved[spec.key];
            s.style.anchor = spec.anchor;
            if (old && typeof old === 'object') {
                if (old.show === false) s.show = false;
                // Only copy keys the section kind actually knows about, so
                // stray fields from the old shape are not carried forward.
                Object.keys(s.data).forEach(function (k) {
                    if (old[k] !== undefined) s.data[k] = clone(old[k]);
                });
            }
            return s;
        });

        // The hero used to be a rotating photo slider. It isn't any more:
        // the first photo survives as an optional still background.
        var hero = sections[0];
        if (saved.hero && Array.isArray(saved.hero.slides) && saved.hero.slides.length &&
            !hero.data.bgImage) {
            var first = saved.hero.slides[0];
            if (first && first.image) hero.data.bgImage = first.image;
        }

        // The old site was a single page. Upgrading gives it the two pages a
        // church site is always asked for next, already written, rather than
        // leaving them to be built from scratch.
        return standardPages(sections);
    }

    /* The address, email, phone and social links used to live inside the
       connect section. They are site-wide now — typed once, shown wherever
       they are needed. */
    function migrateContact(saved, out) {
        var legacy = (saved && saved.connect) || {};
        ['address', 'email', 'phone'].forEach(function (k) {
            if (legacy[k]) out.contact[k] = legacy[k];
        });

        if (Array.isArray(legacy.socials)) {
            out.contact.socials = clone(legacy.socials);
        } else {
            // Older still: four fixed fields rather than a list.
            var real = function (u) { return u && u !== '#'; };
            if (real(legacy.facebook) || real(legacy.instagram)) {
                out.contact.socials = [];
                if (real(legacy.facebook))  out.contact.socials.push({ label: 'Facebook',  icon: 'fab fa-facebook-f', url: legacy.facebook });
                if (real(legacy.instagram)) out.contact.socials.push({ label: 'Instagram', icon: 'fab fa-instagram',  url: legacy.instagram });
                out.contact.socials.push({ label: 'YouTube', icon: 'fab fa-youtube', url: 'https://youtube.com/' });
            }
        }
    }

    /* ---------------------------------------------------------------
       Normalising — run on everything we load, from anywhere.
       --------------------------------------------------------------- */

    function num(v, fallback, min, max) {
        var n = parseFloat(v);
        if (!isFinite(n)) n = fallback;
        return Math.min(max, Math.max(min, Math.round(n)));
    }

    /* Give every list entry an id, so the CMS can address one row of a
       repeatable list without relying on its position. */
    function ensureIds(arr) {
        if (!Array.isArray(arr)) return [];
        arr.forEach(function (item) {
            if (item && typeof item === 'object' && !item.id) item.id = B.uid();
        });
        return arr;
    }

    function normaliseElement(e) {
        if (!e || typeof e !== 'object') return null;
        var def = B.elements[e.type];
        if (!def) return null;                      // an element kind we no longer have
        var out = merge(clone(def.defaults), e);
        out.type = e.type;
        out.id = e.id || B.uid();
        coerceLists(def.fields, out);        // repeatable lists inside an element
        return out;
    }

    function normaliseColumn(c) {
        var out = merge(B.newColumn([]), c || {});
        out.id = (c && c.id) || B.uid();
        out.elements = (Array.isArray(c && c.elements) ? c.elements : [])
            .map(normaliseElement).filter(Boolean);
        return out;
    }

    function normaliseRow(r) {
        r = r || {};
        var spec = B.layout(r.layout);
        var out = merge(B.newRow(spec.v), r);
        out.id = r.id || B.uid();
        out.layout = spec.v;

        var cols = (Array.isArray(r.columns) ? r.columns : []).map(normaliseColumn);
        // Keep the number of columns and the layout in step: pad with empty
        // columns, and fold anything extra into the last one rather than
        // throwing a visitor's content away.
        while (cols.length < spec.cols.length) cols.push(normaliseColumn({ elements: [] }));
        if (cols.length > spec.cols.length) {
            var keep = cols.slice(0, spec.cols.length);
            cols.slice(spec.cols.length).forEach(function (extra) {
                keep[keep.length - 1].elements = keep[keep.length - 1].elements.concat(extra.elements);
            });
            cols = keep;
        }
        cols.forEach(function (c, i) { c.width = spec.cols[i]; });
        out.columns = cols;
        return out;
    }

    /* A field the block library declares as a list must BE a list by the time
       anything tries to draw it. Saved content picks up odd shapes over the
       years — a null, an object, a leftover string — and one of them turning
       into `x.map is not a function` halfway through drawing would take the
       whole page down with it. */
    function coerceLists(fieldDefs, data) {
        (fieldDefs || []).forEach(function (f) {
            if (f.t === 'group') { coerceLists(f.fields, data); return; }
            if (!f.k) return;

            if (f.t === 'items') {
                if (!Array.isArray(data[f.k])) data[f.k] = [];
                data[f.k] = data[f.k].filter(function (row) {
                    return row && typeof row === 'object';
                });
                ensureIds(data[f.k]);
                data[f.k].forEach(function (row) { coerceLists(f.item && f.item.fields, row); });
            } else if (f.t === 'list' && !Array.isArray(data[f.k])) {
                // "Belong, Grow, Lead" typed into what is now a list.
                data[f.k] = typeof data[f.k] === 'string'
                    ? data[f.k].split(',').map(function (v) { return v.trim(); }).filter(Boolean)
                    : [];
            }
        });
        return data;
    }

    function normaliseSection(s) {
        if (!s || typeof s !== 'object' || !s.type) return null;

        var def = B.sections[s.type];
        if (!def) {
            // A kind this version does not know about — a section built by a
            // newer version, say. Keep it exactly as it is so that opening the
            // site on an older copy and publishing cannot destroy it. The
            // renderer simply skips anything it cannot draw.
            return SITE_UNKNOWN(s);
        }

        var out = {
            id: s.id || B.uid(),
            type: s.type,
            name: s.name || '',
            show: s.show !== false,
            style: merge(merge(clone(B.sectionStyleDefaults), def.style || {}), s.style || {}),
            data: merge(clone(def.defaults || {}), s.data || {})
        };

        out.style.padTop    = num(out.style.padTop, 6, 0, 12);
        out.style.padBottom = num(out.style.padBottom, 6, 0, 12);
        out.style.bgOverlay = num(out.style.bgOverlay, 45, 0, 90);
        out.style.anchor    = slugify(out.style.anchor);

        if (s.type === 'blocks') {
            var rows = Array.isArray(out.data.rows) ? out.data.rows : [];
            out.data.rows = rows.filter(function (r) { return r && typeof r === 'object'; })
                                .map(normaliseRow);
            if (!out.data.rows.length) out.data.rows = [B.newRow('1')];
        } else {
            coerceLists(def.fields, out.data);
        }
        return out;
    }

    /* Sections of a kind we do not recognise are carried through untouched. */
    function SITE_UNKNOWN(s) {
        var out = clone(s);
        out.id = s.id || B.uid();
        out.show = s.show !== false;
        out.unknown = true;
        return out;
    }

    function normalisePage(p, index, all) {
        p = p || {};
        var out = {
            id: p.id || B.uid(),
            title: String(p.title || 'Untitled page'),
            slug: p.slug === '' ? '' : slugify(p.slug || p.title || 'page'),
            home: p.home === true,
            showInNav: p.showInNav !== false,
            seo: merge({ title: '', description: '', image: '' }, p.seo || {}),
            sections: (Array.isArray(p.sections) ? p.sections : [])
                        .map(normaliseSection).filter(Boolean)
        };
        return out;
    }

    /* Turn anything we load (including content saved by an earlier version
       of the site) into the current shape, filling any gap with a default. */
    function normalise(saved) {
        saved = (saved && typeof saved === 'object') ? saved : null;

        if (!saved) return defaults();

        var out = merge(clone(SITE_DEFAULTS), {
            version: 2,
            brand:   saved.brand   || {},
            nav:     saved.nav     || {},
            contact: saved.contact || {},
            footer:  saved.footer  || {}
        });

        /* ---- pages ---- */
        if (Array.isArray(saved.pages) && saved.pages.length) {
            out.pages = saved.pages.map(normalisePage).filter(function (p) { return !!p; });
        } else if (saved.hero || saved.vm || saved.impact || saved.gather ||
                   saved.gallery || saved.connect) {
            out.pages = migrateV1(saved).map(normalisePage);
            // The menu was saved before those pages existed, so it has to be
            // told about them. Done once, at the moment of the upgrade.
            addNavLink(out.nav, out.pages[1]);
            addNavLink(out.nav, out.pages[2]);
        } else {
            out.pages = defaults().pages;
        }
        if (!out.pages.length) out.pages = defaults().pages;

        /* Contact details: only pulled out of the old connect section when
           they have not already been saved in their own right. */
        if (!saved.contact) migrateContact(saved, out);

        /* ---- exactly one home page, and unique slugs ---- */
        var home = null;
        out.pages.forEach(function (p) { if (p.home && !home) home = p; else p.home = false; });
        if (!home) { out.pages[0].home = true; home = out.pages[0]; }
        home.slug = '';

        var seen = {};
        out.pages.forEach(function (p) {
            if (p.home) return;
            if (!p.slug) p.slug = slugify(p.title) || 'page';
            while (seen[p.slug]) p.slug = uniqueSlug(out.pages, p.slug, p.id);
            seen[p.slug] = true;
        });

        /* ---- brand: keep the logo sizes sane whatever was saved ---- */
        // The top-bar logo was briefly a percentage of a fixed 46px. It is now
        // a plain pixel height, which is what the CMS slider shows. The ceiling
        // is 62px: the bar itself is a fixed 70px and the logo sits inside it.
        if (saved.brand && saved.brand.navLogoScale !== undefined && !saved.brand.navLogoSize) {
            out.brand.navLogoSize = num(46 * parseFloat(saved.brand.navLogoScale) / 100, 62, 28, 62);
        }
        delete out.brand.navLogoScale;
        out.brand.navLogoSize     = num(out.brand.navLogoSize, 62, 28, 62);
        out.brand.navLogoMaxWidth = num(out.brand.navLogoMaxWidth, 240, 62, 460);
        out.brand.logoScale       = num(out.brand.logoScale, 100, 50, 200);

        /* ---- guard the site-wide lists so a page can never crash ---- */
        out.contact.socials = ensureIds((out.contact.socials || [])
            .filter(function (s) { return s && s.label; }));
        out.nav.links = ensureIds((out.nav.links || [])
            .filter(function (l) { return l && l.label; }));
        if (!Array.isArray(out.footer.values)) out.footer.values = [];

        return out;
    }

    /* ---------------------------------------------------------------
       Finding pages
       --------------------------------------------------------------- */
    function homePage(content) {
        var pages = (content && content.pages) || [];
        for (var i = 0; i < pages.length; i++) if (pages[i].home) return pages[i];
        return pages[0] || null;
    }

    function pageBySlug(content, slug) {
        var pages = (content && content.pages) || [];
        var want = slugify(slug || '');
        if (!want) return homePage(content);
        for (var i = 0; i < pages.length; i++) if (pages[i].slug === want) return pages[i];
        return null;
    }

    function pageById(content, id) {
        var pages = (content && content.pages) || [];
        for (var i = 0; i < pages.length; i++) if (pages[i].id === id) return pages[i];
        return null;
    }

    /* The address a link to this page should use. */
    function pageUrl(page) {
        if (!page || page.home || !page.slug) return '/';
        return '/' + page.slug;
    }

    global.SITE = {
        apiVersion: 2,          // see the note in blocks.js
        defaults: defaults,
        socialPresets: SOCIAL_PRESETS,
        clone: clone,
        merge: merge,
        normalise: normalise,
        slugify: slugify,
        uniqueSlug: uniqueSlug,
        newPage: newPage,
        homePage: homePage,
        pageBySlug: pageBySlug,
        pageById: pageById,
        pageUrl: pageUrl
    };
})(window);
