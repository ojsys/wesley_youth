/* =====================================================================
   The block library.

   Every kind of section and every kind of element the site can contain is
   described exactly once, here:

       label / icon / group   how it appears in the "Add" panel
       defaults               the content a brand-new one starts with
       fields                 the settings the CMS shows when it is selected

   Nothing else in the project hardcodes a list of block types. The public
   renderer (render.js) turns these into HTML; the CMS (admin.html) turns
   `fields` into an editing panel. Adding a new block means adding one entry
   here and one renderer in render.js — the CMS picks it up on its own.

   Exposes:
     BLOCKS.sections        { type: definition }
     BLOCKS.elements        { type: definition }
     BLOCKS.presets         ready-made sections offered in the Add panel
     BLOCKS.layouts         the column arrangements a row can use
     BLOCKS.icons           the icon choices offered by the icon picker
     BLOCKS.uid()           a short unique id
     BLOCKS.newSection(t)   a fresh section of that type
     BLOCKS.newElement(t)   a fresh element of that type
     BLOCKS.newRow(layout)
     BLOCKS.sectionStyleFields   the style settings shared by every section
   ===================================================================== */
(function (global) {
    'use strict';

    /* Short, collision-safe id. Used for sections, rows, columns, elements
       and pages so the CMS can address any one of them by path. */
    var seq = 0;
    function uid() {
        seq += 1;
        return Date.now().toString(36).slice(-5) + seq.toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    /* ---------------------------------------------------------------
       Field shorthands. `fields` is read by the CMS to build a panel;
       every entry is { t: type, k: key, label: ... }.
       --------------------------------------------------------------- */
    function text(k, label, hint)        { return { t: 'text',   k: k, label: label, hint: hint }; }
    function area(k, label, hint, rows)  { return { t: 'area',   k: k, label: label, hint: hint, rows: rows || 3 }; }
    function rich(k, label, hint)        { return { t: 'rich',   k: k, label: label, hint: hint }; }
    function check(k, label, hint)       { return { t: 'check',  k: k, label: label, hint: hint }; }
    function image(k, label, hint)       { return { t: 'image',  k: k, label: label, hint: hint }; }
    function icon(k, label, hint)        { return { t: 'icon',   k: k, label: label, hint: hint }; }
    function color(k, label, hint)       { return { t: 'color',  k: k, label: label, hint: hint }; }
    function link(k, label, hint)        { return { t: 'link',   k: k, label: label, hint: hint }; }
    function list(k, label, hint)        { return { t: 'list',   k: k, label: label, hint: hint }; }
    function num(k, label, min, max, unit, hint) {
        return { t: 'range', k: k, label: label, min: min, max: max, unit: unit || '', hint: hint };
    }
    function pick(k, label, options, hint) {
        return { t: 'select', k: k, label: label, options: options, hint: hint };
    }
    function items(k, label, itemDef, opts) {
        opts = opts || {};
        return {
            t: 'items', k: k, label: label, item: itemDef,
            addLabel: opts.addLabel || 'Add one more',
            hint: opts.hint, max: opts.max
        };
    }
    function group(label, fields, opts) {
        opts = opts || {};
        return { t: 'group', label: label, fields: fields, open: opts.open === true };
    }

    /* Common option sets. */
    var ALIGN   = [{ v: 'left', l: 'Left' }, { v: 'center', l: 'Centre' }, { v: 'right', l: 'Right' }];
    var SIZES   = [{ v: 'xs', l: 'Extra small' }, { v: 'sm', l: 'Small' }, { v: 'md', l: 'Medium' },
                   { v: 'lg', l: 'Large' }, { v: 'xl', l: 'Extra large' }, { v: 'xxl', l: 'Huge' }];
    var HEADING = [{ v: 'h1', l: 'H1 — page title' }, { v: 'h2', l: 'H2 — section title' },
                   { v: 'h3', l: 'H3 — sub-heading' }, { v: 'h4', l: 'H4' },
                   { v: 'h5', l: 'H5' }, { v: 'h6', l: 'H6 — smallest' }];
    var FONTS   = [{ v: 'display', l: 'Display (Anton)' }, { v: 'heading', l: 'Heading (Oswald)' },
                   { v: 'body', l: 'Body (Barlow)' }];
    var BTNSTYLE = [{ v: 'primary', l: 'Gold — solid' }, { v: 'dark', l: 'Dark — solid' },
                    { v: 'ghost', l: 'Outline' }, { v: 'light', l: 'Light outline' },
                    { v: 'plain', l: 'Text link with arrow' }];
    var COLS    = [{ v: '1', l: '1 across' }, { v: '2', l: '2 across' }, { v: '3', l: '3 across' },
                   { v: '4', l: '4 across' }, { v: '5', l: '5 across' }, { v: '6', l: '6 across' }];
    var SHAPE   = [{ v: 'none', l: 'Just the icon' }, { v: 'circle', l: 'In a gold circle' },
                   { v: 'square', l: 'In a rounded square' }, { v: 'ring', l: 'Gold circle with a halo' }];
    var TEXTCOL = [{ v: 'auto', l: 'Follow the section' }, { v: 'ink', l: 'Dark' },
                   { v: 'muted', l: 'Grey' }, { v: 'gold', l: 'Gold' },
                   { v: 'cream', l: 'Cream (for dark backgrounds)' }, { v: 'custom', l: 'Pick a colour…' }];

    /* =================================================================
       Section style — offered on every section, whatever its type.
       ================================================================= */
    var SECTION_STYLE_FIELDS = [
        pick('bg', 'Background', [
            { v: 'cream',  l: 'Cream (the usual page colour)' },
            { v: 'paper',  l: 'Paper — a shade lighter' },
            { v: 'cream2', l: 'Sand — a shade darker' },
            { v: 'ink',    l: 'Dark' },
            { v: 'gold',   l: 'Gold' },
            { v: 'custom', l: 'A colour I choose…' },
            { v: 'image',  l: 'A photo' }
        ]),
        color('bgColor', 'Background colour', 'Used when "A colour I choose" is picked above.'),
        image('bgImage', 'Background photo', 'Used when "A photo" is picked above.'),
        num('bgOverlay', 'How much the photo is darkened', 0, 90, '%',
            'Higher numbers make white text easier to read.'),
        check('bgFixed', 'Photo stays still as the page scrolls'),
        pick('width', 'How wide the content runs', [
            { v: 'wide',   l: 'Normal (1160px)' },
            { v: 'narrow', l: 'Narrow — good for reading (760px)' },
            { v: 'mid',    l: 'Medium (960px)' },
            { v: 'full',   l: 'Edge to edge' }
        ]),
        num('padTop', 'Space above', 0, 12, 'rem'),
        num('padBottom', 'Space below', 0, 12, 'rem'),
        check('animate', 'Fade the content in as it scrolls into view'),
        text('anchor', 'Link name (anchor)',
             'Lets a menu link jump straight here, e.g. typing "vision" makes the link #vision work.')
    ];

    var SECTION_STYLE_DEFAULTS = {
        bg: 'cream', bgColor: '#FBF6E9', bgImage: '', bgOverlay: 45, bgFixed: false,
        width: 'wide', padTop: 6, padBottom: 6, animate: true, anchor: ''
    };

    /* =================================================================
       ELEMENTS — the things that go inside a column.
       ================================================================= */
    var ELEMENTS = {

        heading: {
            label: 'Heading', icon: 'fa-heading', group: 'Basic',
            defaults: { text: 'A heading goes here', accent: '', level: 'h2', font: 'display',
                        size: 'lg', align: 'left', colour: 'auto', customColour: '#141210', kicker: '' },
            fields: [
                text('kicker', 'Small label above', 'Optional — the little gold line, e.g. "Why we exist".'),
                text('text', 'Heading'),
                text('accent', 'Words shown in gold', 'Optional — appears after the heading, in gold.'),
                pick('level', 'Heading level', HEADING, 'Affects search engines and screen readers, not the size.'),
                pick('font', 'Typeface', FONTS),
                pick('size', 'Size', SIZES),
                pick('align', 'Alignment', ALIGN),
                pick('colour', 'Colour', TEXTCOL),
                color('customColour', 'Custom colour')
            ]
        },

        text: {
            label: 'Text', icon: 'fa-align-left', group: 'Basic',
            defaults: { html: '<p>Write anything you like here. Use the toolbar to make words bold, add a link, or start a list.</p>',
                        size: 'md', align: 'left', colour: 'auto', customColour: '#2B2926', columns: '1' },
            fields: [
                rich('html', 'Text'),
                pick('size', 'Text size', SIZES),
                pick('align', 'Alignment', ALIGN),
                pick('columns', 'Split into columns', [{ v: '1', l: 'One column' }, { v: '2', l: 'Two columns' }, { v: '3', l: 'Three columns' }]),
                pick('colour', 'Colour', TEXTCOL),
                color('customColour', 'Custom colour')
            ]
        },

        image: {
            label: 'Image', icon: 'fa-image', group: 'Basic',
            defaults: { src: '', alt: '', caption: '', align: 'center', width: 100,
                        radius: 20, ratio: 'auto', shadow: true, link: '', lightbox: true },
            fields: [
                image('src', 'Photo'),
                text('alt', 'Description for screen readers', 'What is in the photo. Also shown if it fails to load.'),
                text('caption', 'Caption', 'Optional words printed under the photo.'),
                num('width', 'Width', 10, 100, '%'),
                pick('align', 'Alignment', ALIGN),
                pick('ratio', 'Shape', [
                    { v: 'auto',  l: 'The photo\'s own shape' },
                    { v: '1',     l: 'Square' },
                    { v: '4/3',   l: 'Landscape 4:3' },
                    { v: '16/9',  l: 'Wide 16:9' },
                    { v: '3/4',   l: 'Portrait 3:4' },
                    { v: '2/1',   l: 'Letterbox 2:1' }
                ]),
                num('radius', 'Rounded corners', 0, 40, 'px'),
                check('shadow', 'Drop shadow'),
                link('link', 'Go to this link when clicked', 'Leave empty to do nothing.'),
                check('lightbox', 'Open full size when clicked', 'Ignored when a link is set above.')
            ]
        },

        buttons: {
            label: 'Buttons', icon: 'fa-hand-pointer', group: 'Basic',
            defaults: {
                align: 'left', size: 'md',
                list: [{ id: '', text: 'Find out more', link: '#', style: 'primary', icon: 'fa-arrow-right', newTab: false }]
            },
            fields: [
                items('list', 'Buttons', {
                    label: function (d) { return d.text || 'Button'; },
                    defaults: { text: 'Button', link: '#', style: 'primary', icon: '', newTab: false },
                    fields: [
                        text('text', 'Label'),
                        link('link', 'Link'),
                        pick('style', 'Style', BTNSTYLE),
                        icon('icon', 'Icon', 'Optional.'),
                        check('newTab', 'Open in a new tab')
                    ]
                }, { addLabel: 'Add a button' }),
                pick('align', 'Alignment', ALIGN),
                pick('size', 'Size', [{ v: 'sm', l: 'Small' }, { v: 'md', l: 'Normal' }, { v: 'lg', l: 'Large' }])
            ]
        },

        icon: {
            label: 'Icon', icon: 'fa-star', group: 'Basic',
            defaults: { icon: 'fa-heart', size: 48, shape: 'circle', align: 'center',
                        colour: 'auto', customColour: '#D99A00', link: '' },
            fields: [
                icon('icon', 'Icon'),
                num('size', 'Size', 16, 120, 'px'),
                pick('shape', 'Background', SHAPE),
                pick('align', 'Alignment', ALIGN),
                pick('colour', 'Icon colour', TEXTCOL),
                color('customColour', 'Custom colour'),
                link('link', 'Link', 'Optional.')
            ]
        },

        iconbox: {
            label: 'Icon + text', icon: 'fa-icons', group: 'Basic',
            defaults: { icon: 'fa-people-group', title: 'Something we do', shape: 'ring',
                        html: '<p>A sentence or two about it.</p>', layout: 'top', align: 'center',
                        card: false, link: '', linkText: '' },
            fields: [
                icon('icon', 'Icon'),
                text('title', 'Title'),
                rich('html', 'Text'),
                pick('layout', 'Arrangement', [
                    { v: 'top',  l: 'Icon above the words' },
                    { v: 'left', l: 'Icon beside the words' }
                ]),
                pick('shape', 'Icon background', SHAPE),
                pick('align', 'Alignment', ALIGN),
                check('card', 'Put it on a card'),
                text('linkText', 'Link label', 'Optional link shown at the bottom.'),
                link('link', 'Link')
            ]
        },

        spacer: {
            label: 'Blank space', icon: 'fa-arrows-up-down', group: 'Layout',
            defaults: { height: 40 },
            fields: [num('height', 'Height', 0, 240, 'px')]
        },

        divider: {
            label: 'Divider line', icon: 'fa-minus', group: 'Layout',
            defaults: { style: 'solid', width: 100, thickness: 1, colour: 'auto',
                        customColour: '#D99A00', align: 'center', sprout: false, sproutIcon: 'fa-seedling' },
            fields: [
                check('sprout', 'Decorated with a small icon in the middle'),
                icon('sproutIcon', 'Middle icon'),
                pick('style', 'Line style', [{ v: 'solid', l: 'Solid' }, { v: 'dashed', l: 'Dashed' },
                                              { v: 'dotted', l: 'Dotted' }, { v: 'fade', l: 'Fading out at the ends' }]),
                num('width', 'Width', 10, 100, '%'),
                num('thickness', 'Thickness', 1, 10, 'px'),
                pick('align', 'Alignment', ALIGN),
                pick('colour', 'Colour', TEXTCOL),
                color('customColour', 'Custom colour')
            ]
        },

        video: {
            label: 'Video', icon: 'fa-play', group: 'Media',
            defaults: { url: '', caption: '', ratio: '16/9', radius: 20 },
            fields: [
                text('url', 'Video link', 'Paste a YouTube or Vimeo address, or a link to an .mp4 file.'),
                pick('ratio', 'Shape', [{ v: '16/9', l: 'Widescreen 16:9' }, { v: '4/3', l: 'Classic 4:3' },
                                        { v: '1', l: 'Square' }, { v: '9/16', l: 'Upright (phone video)' }]),
                num('radius', 'Rounded corners', 0, 40, 'px'),
                text('caption', 'Caption')
            ]
        },

        gallery: {
            label: 'Photo grid', icon: 'fa-images', group: 'Media',
            defaults: {
                columns: '3', gap: 20, radius: 20, ratio: '4/5', lightbox: true, captions: true,
                list: [{ id: '', image: '', title: '', desc: '' }]
            },
            fields: [
                items('list', 'Photos', {
                    label: function (d) { return d.title || 'Photo'; },
                    defaults: { image: '', title: '', desc: '' },
                    fields: [image('image', 'Photo'), text('title', 'Title'), text('desc', 'Caption')],
                    thumb: 'image'
                }, { addLabel: 'Add a photo' }),
                pick('columns', 'Photos across', COLS),
                pick('ratio', 'Shape', [{ v: '4/5', l: 'Portrait 4:5' }, { v: '1', l: 'Square' },
                                        { v: '4/3', l: 'Landscape 4:3' }, { v: '16/9', l: 'Wide 16:9' },
                                        { v: 'auto', l: 'Each photo\'s own shape' }]),
                num('gap', 'Space between', 0, 48, 'px'),
                num('radius', 'Rounded corners', 0, 40, 'px'),
                check('captions', 'Show titles over the photos'),
                check('lightbox', 'Open full size when clicked')
            ]
        },

        cards: {
            label: 'Cards', icon: 'fa-table-cells-large', group: 'Content',
            defaults: {
                columns: '3', style: 'light',
                list: [{ id: '', image: '', tag: '', title: 'A card', text: 'A short description.',
                         btnText: 'Read more', btnLink: '#', meta: '', metaIcon: 'fa-location-dot' }]
            },
            fields: [
                items('list', 'Cards', {
                    label: function (d) { return d.title || 'Card'; },
                    defaults: { image: '', tag: '', title: 'A card', text: '', btnText: '', btnLink: '#',
                                meta: '', metaIcon: 'fa-location-dot' },
                    fields: [
                        image('image', 'Photo'),
                        text('tag', 'Corner badge', 'Optional, e.g. "Every Wednesday".'),
                        text('title', 'Title'),
                        area('text', 'Text'),
                        text('meta', 'Small line at the bottom', 'Optional, e.g. a place or a time.'),
                        icon('metaIcon', 'Icon for that line'),
                        text('btnText', 'Button label', 'Leave empty for no button.'),
                        link('btnLink', 'Button link')
                    ],
                    thumb: 'image'
                }, { addLabel: 'Add a card' }),
                pick('columns', 'Cards across', COLS),
                pick('style', 'Style', [{ v: 'light', l: 'Light card' }, { v: 'dark', l: 'Dark card' },
                                        { v: 'plain', l: 'No card — just the contents' }])
            ]
        },

        list: {
            label: 'Tick list', icon: 'fa-list-check', group: 'Content',
            defaults: {
                icon: 'fa-check', columns: '1', size: 'md',
                list: [{ id: '', text: 'Something worth listing' }, { id: '', text: 'And another' }]
            },
            fields: [
                items('list', 'Lines', {
                    label: function (d) { return d.text || 'Line'; },
                    defaults: { text: '', icon: '' },
                    fields: [text('text', 'Text'), icon('icon', 'Icon', 'Leave empty to use the shared one below.')]
                }, { addLabel: 'Add a line' }),
                icon('icon', 'Icon used for every line'),
                pick('columns', 'Columns', [{ v: '1', l: 'One' }, { v: '2', l: 'Two' }, { v: '3', l: 'Three' }]),
                pick('size', 'Text size', SIZES)
            ]
        },

        quote: {
            label: 'Quote', icon: 'fa-quote-left', group: 'Content',
            defaults: { text: 'Something someone said that is worth repeating.',
                        author: '', role: '', photo: '', align: 'center', style: 'mark' },
            fields: [
                area('text', 'The quote', null, 4),
                text('author', 'Who said it'),
                text('role', 'Their role', 'Optional, e.g. "Student, class of 2026".'),
                image('photo', 'Their photo', 'Optional.'),
                pick('style', 'Style', [{ v: 'mark', l: 'With a big quote mark' },
                                        { v: 'bar', l: 'With a gold bar down the side' },
                                        { v: 'card', l: 'On a card' }]),
                pick('align', 'Alignment', ALIGN)
            ]
        },

        stats: {
            label: 'Numbers', icon: 'fa-chart-simple', group: 'Content',
            defaults: {
                columns: '3', countUp: true,
                list: [{ id: '', number: '120', suffix: '+', label: 'Students each week' }]
            },
            fields: [
                items('list', 'Numbers', {
                    label: function (d) { return (d.number || '') + ' ' + (d.label || ''); },
                    defaults: { number: '0', suffix: '', label: 'What it counts' },
                    fields: [text('number', 'Number'), text('suffix', 'After the number', 'e.g. + or %'),
                             text('label', 'What it counts')]
                }, { addLabel: 'Add a number' }),
                pick('columns', 'Across', COLS),
                check('countUp', 'Count up when it scrolls into view')
            ]
        },

        accordion: {
            label: 'Questions (accordion)', icon: 'fa-circle-chevron-down', group: 'Content',
            defaults: {
                openFirst: true,
                list: [{ id: '', title: 'A question people ask', html: '<p>The answer.</p>' }]
            },
            fields: [
                items('list', 'Questions', {
                    label: function (d) { return d.title || 'Question'; },
                    defaults: { title: 'A question', html: '<p>The answer.</p>' },
                    fields: [text('title', 'Question'), rich('html', 'Answer')]
                }, { addLabel: 'Add a question' }),
                check('openFirst', 'Show the first answer already open')
            ]
        },

        socials: {
            label: 'Social links', icon: 'fa-share-nodes', group: 'Content',
            defaults: { align: 'left', style: 'dark', size: 46 },
            fields: [
                { t: 'note', text: 'These are the links from Contact &amp; Socials, so they stay the same everywhere on the site.' },
                pick('align', 'Alignment', ALIGN),
                pick('style', 'Style', [{ v: 'dark', l: 'Dark tiles' }, { v: 'gold', l: 'Gold tiles' },
                                        { v: 'outline', l: 'Outlined' }]),
                num('size', 'Size', 32, 64, 'px')
            ]
        },

        emblem: {
            label: 'Logo / emblem', icon: 'fa-certificate', group: 'Content',
            defaults: { size: 130, align: 'center', glow: true, link: '' },
            fields: [
                { t: 'note', text: 'Shows the logo set under Identity &amp; Logo.' },
                num('size', 'Size', 40, 320, 'px'),
                pick('align', 'Alignment', ALIGN),
                check('glow', 'Soft gold glow behind it'),
                link('link', 'Link', 'Optional.')
            ]
        },

        form: {
            label: 'Contact form', icon: 'fa-envelope-open-text', group: 'Content',
            defaults: { title: 'Send us a message', note: 'We usually reply within a day or two.',
                        button: 'Send it', card: true },
            fields: [
                { t: 'note', text: 'Messages arrive in <strong>Messages</strong> and are emailed to the address in <strong>Settings</strong>.' },
                text('title', 'Heading above the form'),
                text('note', 'Small note under the heading'),
                text('button', 'Button label'),
                check('card', 'Put the form on a card')
            ]
        },

        contactinfo: {
            label: 'Address & phone', icon: 'fa-address-book', group: 'Content',
            defaults: { showAddress: true, showEmail: true, showPhone: true, style: 'tiles' },
            fields: [
                { t: 'note', text: 'Uses the details from Contact &amp; Socials.' },
                check('showAddress', 'Show the address'),
                check('showEmail', 'Show the email address'),
                check('showPhone', 'Show the phone number'),
                pick('style', 'Style', [{ v: 'tiles', l: 'Gold icon tiles' }, { v: 'plain', l: 'Plain lines' }])
            ]
        },

        map: {
            label: 'Map', icon: 'fa-map-location-dot', group: 'Media',
            defaults: { query: '', height: 380, radius: 20 },
            fields: [
                text('query', 'Address or place', 'Leave empty to use the address from Contact & Socials.'),
                num('height', 'Height', 200, 700, 'px'),
                num('radius', 'Rounded corners', 0, 40, 'px')
            ]
        },

        html: {
            label: 'Custom code', icon: 'fa-code', group: 'Advanced',
            defaults: { html: '' },
            fields: [
                { t: 'note', text: 'For embed codes from other services. Anything pasted here is put on the page as-is, so only paste code you trust.' },
                area('html', 'HTML', null, 8)
            ]
        }
    };

    /* =================================================================
       SECTIONS
       ================================================================= */

    /* The six sections the site was originally built from. Their content
       and their look are unchanged — they are simply blocks now, so they
       can be reordered, duplicated, removed, or used on any page. */
    var SECTIONS = {

        hero: {
            label: 'Hero — the big opening', icon: 'fa-mountain-sun', group: 'Headers',
            // These three size themselves; the "space above / below" sliders
            // would only fight with the height setting they offer instead.
            fixedPad: true,
            style: { padTop: 0, padBottom: 0, width: 'full', bg: 'cream', animate: false },
            defaults: {
                background: 'plain', bgImage: '', bgOverlay: 78,
                showEmblem: true, showScene: true,
                kicker: 'Campus Ministry · Iowa City',
                title: 'First United Methodist Church & Wesley Foundation',
                titleSub: 'A community of faith at the heart of campus',
                line1: 'Grace for Today.',
                line2: 'Impact for Tomorrow.',
                sub: "No perfect people required. Free dinner every Wednesday, honest conversations, and a family that meets you exactly where you are — figuring out life, faith, and everything in between.",
                values: ['Belong', 'Grow', 'Lead', 'Serve'],
                btn1Text: "See What's On", btn1Link: '#gather', btn1Icon: 'fa-calendar-day',
                btn2Text: 'Come As You Are', btn2Link: '#connect', btn2Icon: 'fa-comments'
            },
            fields: [
                group('Background', [
                    pick('background', 'Behind the words', [
                        { v: 'plain', l: 'A calm plain background' },
                        { v: 'image', l: 'One still photo' }
                    ]),
                    image('bgImage', 'The photo'),
                    num('bgOverlay', 'How much the photo is softened', 0, 100, '%',
                        'Higher numbers make the words easier to read.'),
                    check('showScene', 'Show the illustrated skyline along the bottom'),
                    check('showEmblem', 'Show the logo above the words')
                ], { open: true }),
                group('Words', [
                    text('kicker', 'Small line at the very top'),
                    text('title', 'Name'),
                    text('titleSub', 'Line under the name'),
                    text('line1', 'Big headline — first line'),
                    text('line2', 'Big headline — second line', 'Shown in gold.'),
                    area('sub', 'Welcome paragraph', null, 4),
                    list('values', 'The words in a row', 'Separated by commas.')
                ], { open: true }),
                group('Buttons', [
                    text('btn1Text', 'First button'), link('btn1Link', 'Its link'), icon('btn1Icon', 'Its icon'),
                    text('btn2Text', 'Second button'), link('btn2Link', 'Its link'), icon('btn2Icon', 'Its icon')
                ])
            ]
        },

        pagehero: {
            label: 'Page header', icon: 'fa-heading', group: 'Headers', fixedPad: true,
            style: { padTop: 0, padBottom: 0, width: 'full', bg: 'cream', animate: false },
            defaults: {
                kicker: '', title: 'About Us', titleAccent: '', sub: '',
                background: 'plain', bgImage: '', bgOverlay: 55, height: 'md',
                align: 'center', crumbs: true, btnText: '', btnLink: '#'
            },
            fields: [
                text('kicker', 'Small label above the title'),
                text('title', 'Title'),
                text('titleAccent', 'Words in gold', 'Optional — added after the title.'),
                area('sub', 'Line underneath'),
                pick('height', 'Height', [{ v: 'sm', l: 'Short' }, { v: 'md', l: 'Medium' }, { v: 'lg', l: 'Tall' }]),
                pick('align', 'Alignment', ALIGN),
                pick('background', 'Background', [{ v: 'plain', l: 'Plain' }, { v: 'image', l: 'A photo' },
                                                  { v: 'dark', l: 'Dark' }]),
                image('bgImage', 'The photo'),
                num('bgOverlay', 'How much the photo is darkened', 0, 90, '%'),
                check('crumbs', 'Show the trail back to the home page'),
                text('btnText', 'Button', 'Optional.'),
                link('btnLink', 'Button link')
            ]
        },

        slider: {
            label: 'Slideshow', icon: 'fa-sliders', group: 'Headers', fixedPad: true,
            style: { padTop: 0, padBottom: 0, width: 'full', bg: 'ink', animate: false },
            defaults: {
                height: 'lg', autoplay: true, interval: 6, arrows: true, dots: true,
                effect: 'fade', overlay: 45, align: 'center',
                list: [
                    { id: '', image: '', kicker: 'Welcome', title: 'A headline for this slide',
                      text: 'A sentence that explains it.', btnText: 'Find out more', btnLink: '#',
                      btn2Text: '', btn2Link: '#' }
                ]
            },
            fields: [
                items('list', 'Slides', {
                    label: function (d) { return d.title || 'Slide'; },
                    defaults: { image: '', kicker: '', title: 'A headline', text: '',
                                btnText: '', btnLink: '#', btn2Text: '', btn2Link: '#' },
                    fields: [
                        image('image', 'Photo'),
                        text('kicker', 'Small label above'),
                        text('title', 'Headline'),
                        area('text', 'Text'),
                        text('btnText', 'Button'), link('btnLink', 'Its link'),
                        text('btn2Text', 'Second button'), link('btn2Link', 'Its link')
                    ],
                    thumb: 'image'
                }, { addLabel: 'Add a slide' }),
                pick('height', 'Height', [{ v: 'sm', l: 'Short' }, { v: 'md', l: 'Medium' },
                                          { v: 'lg', l: 'Tall' }, { v: 'full', l: 'The whole screen' }]),
                pick('effect', 'How slides change', [{ v: 'fade', l: 'Fade' }, { v: 'slide', l: 'Slide across' }]),
                pick('align', 'Where the words sit', ALIGN),
                num('overlay', 'How much the photo is darkened', 0, 90, '%'),
                check('autoplay', 'Move on by itself'),
                num('interval', 'Seconds on each slide', 2, 20, 's'),
                check('arrows', 'Show the arrows'),
                check('dots', 'Show the dots')
            ]
        },

        vm: {
            label: 'Vision & Mission', icon: 'fa-eye', group: 'Church',
            style: { bg: 'paper', width: 'wide', padTop: 6, padBottom: 6 },
            defaults: {
                label: 'Why We Exist', titleMain: 'Vision', titleAccent: '& Mission',
                visionTitle: 'Vision', visionIcon: 'fa-eye',
                visionText: 'To be a community of faith through which grace is offered to all — and each person is empowered to impact the world for good.',
                missionTitle: 'Mission', missionIcon: 'fa-bullseye',
                missionText: 'Our mission is to be disciples of Jesus Christ for the transformation of the world.'
            },
            fields: [
                text('label', 'Small label above the title'),
                text('titleMain', 'Title'), text('titleAccent', 'Words in gold'),
                group('Vision', [text('visionTitle', 'Heading'), icon('visionIcon', 'Icon'),
                                 area('visionText', 'Text', null, 4)], { open: true }),
                group('Mission', [text('missionTitle', 'Heading'), icon('missionIcon', 'Icon'),
                                  area('missionText', 'Text', null, 4)], { open: true })
            ]
        },

        impact: {
            label: 'Impact Areas', icon: 'fa-people-group', group: 'Church',
            style: { bg: 'cream', width: 'wide', padTop: 6, padBottom: 6 },
            defaults: {
                label: 'How We Live It Out', titleMain: 'Our Four', titleAccent: 'Impact Areas',
                intro: 'Four ways we grow together and turn faith into action — on campus and beyond.',
                areas: [
                    { id: '', icon: 'fa-people-group',       title: 'Building Beloved Community',        text: 'We cultivate belonging, hospitality, and relationships rooted in love and grace for all.' },
                    { id: '', icon: 'fa-book-bible',         title: 'Spiritual Growth',                  text: 'We nurture faith through worship, study, reflection, and practices that deepen our relationship with God.' },
                    { id: '', icon: 'fa-flag',               title: 'Leadership Development',            text: 'We equip and empower students to discover their gifts and lead with courage, integrity, and purpose.' },
                    { id: '', icon: 'fa-hand-holding-heart', title: 'Faithful Service & Social Justice', text: 'We respond to the needs of the world through service, advocacy, and working for justice and peace.' }
                ]
            },
            fields: [
                text('label', 'Small label above the title'),
                text('titleMain', 'Title'), text('titleAccent', 'Words in gold'),
                area('intro', 'Introduction'),
                items('areas', 'The cards', {
                    label: function (d) { return d.title || 'Card'; },
                    defaults: { icon: 'fa-star', title: 'A new area', text: '' },
                    fields: [icon('icon', 'Icon'), text('title', 'Title'), area('text', 'Text')]
                }, { addLabel: 'Add a card',
                     hint: 'Exactly 4 arranges them around the emblem; any other number uses a plain grid.' })
            ]
        },

        gather: {
            label: 'Gatherings', icon: 'fa-calendar-day', group: 'Church',
            style: { bg: 'ink', width: 'wide', padTop: 6, padBottom: 6 },
            defaults: {
                label: 'This Week', titleMain: 'Come', titleAccent: 'Gather.',
                intro: "Free food. Real talk. Good people. Everyone's welcome at the table.",
                items: [
                    { id: '', image: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&h=600&fit=crop', tag: 'Every Wednesday', time: 'Wednesdays · 6:30 PM', title: 'Wednesday Night Reset', desc: 'Dinner, fellowship, and real conversation. No homework required — just show up hungry for food and for community.', location: '120 N. Dubuque St.', btnText: "I'm Coming", btnLink: '#connect' },
                    { id: '', image: 'https://images.unsplash.com/photo-1519491050282-cf00c82424ae?w=800&h=600&fit=crop', tag: 'Every Sunday', time: 'Sundays · 8:30 & 10:30 AM', title: 'Sunday Morning Worship', desc: "Start your week with music, message, and a community that actually cares how you're doing.", location: '214 E. Jefferson St.', btnText: 'Learn More', btnLink: '#connect' },
                    { id: '', image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop', tag: 'Coming Soon', time: 'TBA — Stay Tuned', title: 'Retreats & Special Events', desc: "Game nights, pasta making, tie blankets, Christmas parties, mission trips — there's always something brewing.", location: 'Various Locations', btnText: 'Get Notified', btnLink: '#connect' }
                ]
            },
            fields: [
                text('label', 'Small label above the title'),
                text('titleMain', 'Title'), text('titleAccent', 'Words in gold'),
                area('intro', 'Introduction'),
                items('items', 'The events', {
                    label: function (d) { return d.title || 'Event'; },
                    defaults: { image: '', tag: '', time: '', title: 'A new gathering', desc: '',
                                location: '', btnText: 'Learn more', btnLink: '#connect' },
                    fields: [
                        image('image', 'Photo'),
                        text('tag', 'Corner badge'),
                        text('time', 'When'),
                        text('title', 'Name'),
                        area('desc', 'Description'),
                        text('location', 'Where'),
                        text('btnText', 'Button label'), link('btnLink', 'Button link')
                    ],
                    thumb: 'image'
                }, { addLabel: 'Add a gathering' })
            ]
        },

        gallery: {
            label: 'Photo Gallery', icon: 'fa-camera', group: 'Church',
            style: { bg: 'cream2', width: 'wide', padTop: 6, padBottom: 6 },
            defaults: {
                layout: 'grid', label: 'The Moments', titleMain: 'This Is', titleAccent: 'Us.',
                intro: 'Real students. Real moments. Real community.',
                items: [
                    { id: '', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=1000&fit=crop', title: 'Wednesday Night',     desc: 'Good food, better people' },
                    { id: '', image: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=800&h=1000&fit=crop', title: 'Christmas Party',      desc: 'Joy, laughter & ugly sweaters' },
                    { id: '', image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=1000&fit=crop', title: 'Making Tie Blankets', desc: 'Crafting warmth for those in need' },
                    { id: '', image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=1000&fit=crop', title: 'Pasta Making',         desc: 'Handmade with love (and flour)' },
                    { id: '', image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=1000&fit=crop', title: 'Worship Night',      desc: 'Music that moves the soul' },
                    { id: '', image: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&h=1000&fit=crop', title: 'Study & Chill',      desc: 'Coffee, books & good company' }
                ]
            },
            fields: [
                text('label', 'Small label above the title'),
                text('titleMain', 'Title'), text('titleAccent', 'Words in gold'),
                area('intro', 'Introduction'),
                pick('layout', 'Arrangement', [
                    { v: 'grid',  l: 'A tidy grid' },
                    { v: 'strip', l: 'A row you swipe sideways' }
                ]),
                items('items', 'Photos', {
                    label: function (d) { return d.title || 'Photo'; },
                    defaults: { image: '', title: '', desc: '' },
                    fields: [image('image', 'Photo'), text('title', 'Title'), text('desc', 'Caption')],
                    thumb: 'image'
                }, { addLabel: 'Add a photo' })
            ]
        },

        connect: {
            label: 'Contact & form', icon: 'fa-paper-plane', group: 'Church',
            style: { bg: 'paper', width: 'wide', padTop: 6, padBottom: 6 },
            defaults: {
                label: 'Reach Out', titleMain: "Let's", titleAccent: 'Connect.',
                sub: "Got questions, doubts, or just want to know where the free food is? We'd love to hear from you. No spam, no pressure — just real people ready to welcome you in.",
                formTitle: 'Send us a message',
                formNote: 'We usually reply within a day or two.',
                showForm: true, showSocials: true
            },
            fields: [
                text('label', 'Small label above the title'),
                text('titleMain', 'Title'), text('titleAccent', 'Words in gold'),
                area('sub', 'Introduction', null, 4),
                check('showForm', 'Show the message form'),
                text('formTitle', 'Heading above the form'),
                text('formNote', 'Small note under it'),
                check('showSocials', 'Show the social links'),
                { t: 'note', text: 'The address, email and phone shown here come from <strong>Contact &amp; Socials</strong>, so they only have to be typed once.' }
            ]
        },

        blocks: {
            label: 'Blank section', icon: 'fa-table-columns', group: 'Build your own',
            style: { bg: 'cream', width: 'wide', padTop: 5, padBottom: 5 },
            defaults: { rows: null },   // filled in by newSection()
            fields: [
                { t: 'note', text: 'Click anything inside this section on the page to edit it, or use <strong>Add element</strong> to put something new in a column.' }
            ]
        }
    };

    /* =================================================================
       Column arrangements available to a row.
       ================================================================= */
    var LAYOUTS = [
        { v: '1',       l: 'One column',        cols: [100] },
        { v: '1-1',     l: 'Two equal',         cols: [50, 50] },
        { v: '1-2',     l: 'Narrow + wide',     cols: [33.33, 66.67] },
        { v: '2-1',     l: 'Wide + narrow',     cols: [66.67, 33.33] },
        { v: '1-3',     l: 'Sidebar + wide',    cols: [25, 75] },
        { v: '3-1',     l: 'Wide + sidebar',    cols: [75, 25] },
        { v: '1-1-1',   l: 'Three equal',       cols: [33.33, 33.33, 33.33] },
        { v: '1-2-1',   l: 'Three, wide middle',cols: [25, 50, 25] },
        { v: '1-1-1-1', l: 'Four equal',        cols: [25, 25, 25, 25] },
        { v: '1-1-1-1-1', l: 'Five equal',      cols: [20, 20, 20, 20, 20] },
        { v: '1x6',     l: 'Six equal',         cols: [16.66, 16.66, 16.66, 16.66, 16.66, 16.66] }
    ];

    function layout(v) {
        for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].v === v) return LAYOUTS[i];
        return LAYOUTS[0];
    }

    var ROW_FIELDS = [
        pick('layout', 'Columns', LAYOUTS.map(function (l) { return { v: l.v, l: l.l }; })),
        num('gap', 'Space between columns', 0, 80, 'px'),
        pick('valign', 'Line the columns up', [
            { v: 'stretch', l: 'Same height' },
            { v: 'top',     l: 'At the top' },
            { v: 'middle',  l: 'In the middle' },
            { v: 'bottom',  l: 'At the bottom' }
        ]),
        check('reverse', 'Swap the order on phones'),
        num('padTop', 'Space above this row', 0, 120, 'px'),
        num('padBottom', 'Space below this row', 0, 120, 'px')
    ];

    var COLUMN_FIELDS = [
        pick('bg', 'Background', [
            { v: 'none',   l: 'None' },
            { v: 'paper',  l: 'Paper' },
            { v: 'cream',  l: 'Cream' },
            { v: 'ink',    l: 'Dark' },
            { v: 'gold',   l: 'Gold' },
            { v: 'custom', l: 'A colour I choose…' }
        ]),
        color('bgColor', 'Background colour'),
        image('bgImage', 'Background photo'),
        num('pad', 'Space inside', 0, 80, 'px'),
        num('radius', 'Rounded corners', 0, 40, 'px'),
        check('border', 'Thin border'),
        check('shadow', 'Drop shadow'),
        pick('valign', 'Contents sit', [
            { v: 'top', l: 'At the top' }, { v: 'middle', l: 'In the middle' }, { v: 'bottom', l: 'At the bottom' }
        ])
    ];

    /* =================================================================
       Ready-made sections offered in the Add panel. Each one builds a
       normal "blocks" section that can then be edited like any other.
       ================================================================= */
    var PRESETS = [
        {
            key: 'text',  label: 'Heading and text', icon: 'fa-align-left', group: 'Build your own',
            build: function () {
                return row('1', [[el('heading', { text: 'A heading', align: 'center', size: 'lg' }),
                                  el('text', { align: 'center' })]]);
            }
        },
        {
            key: 'textimage', label: 'Text beside a photo', icon: 'fa-image', group: 'Build your own',
            build: function () {
                return row('1-1', [
                    [el('heading', { text: 'Tell them about it', size: 'lg' }), el('text', {}),
                     el('buttons', {})],
                    [el('image', { ratio: '4/3' })]
                ], { valign: 'middle' });
            }
        },
        {
            key: 'features', label: 'Three features', icon: 'fa-icons', group: 'Build your own',
            build: function () {
                return row('1-1-1', [
                    [el('iconbox', { icon: 'fa-heart', title: 'The first thing' })],
                    [el('iconbox', { icon: 'fa-hands-praying', title: 'The second' })],
                    [el('iconbox', { icon: 'fa-handshake-angle', title: 'The third' })]
                ]);
            }
        },
        {
            key: 'cta', label: 'Call to action banner', icon: 'fa-bullhorn', group: 'Build your own',
            style: { bg: 'ink', padTop: 4, padBottom: 4 },
            build: function () {
                return row('1', [[
                    el('heading', { text: 'Come and see', align: 'center', size: 'xl', colour: 'cream' }),
                    el('text', { align: 'center', colour: 'cream',
                                 html: '<p>A line that invites people to do the thing.</p>' }),
                    el('buttons', { align: 'center',
                                    list: [{ id: uid(), text: 'Plan your visit', link: '#connect',
                                             style: 'primary', icon: 'fa-arrow-right', newTab: false }] })
                ]]);
            }
        },
        {
            key: 'faq', label: 'Questions & answers', icon: 'fa-circle-question', group: 'Build your own',
            style: { width: 'mid' },
            build: function () {
                return row('1', [[el('heading', { text: 'Questions', accent: 'people ask',
                                                  align: 'center', size: 'lg' }),
                                  el('accordion', {})]]);
            }
        },
        {
            key: 'stats', label: 'Numbers strip', icon: 'fa-chart-simple', group: 'Build your own',
            style: { bg: 'gold', padTop: 3, padBottom: 3 },
            build: function () {
                return row('1', [[el('stats', {
                    columns: '3',
                    list: [
                        { id: uid(), number: '120', suffix: '+', label: 'Students each week' },
                        { id: uid(), number: '45',  suffix: '',  label: 'Years on campus' },
                        { id: uid(), number: '12',  suffix: '',  label: 'Mission trips' }
                    ]
                })]]);
            }
        },
        {
            key: 'team', label: 'People', icon: 'fa-user-group', group: 'Build your own',
            build: function () {
                return row('1', [[
                    el('heading', { text: 'Meet the', accent: 'team', align: 'center', size: 'lg' }),
                    el('cards', {
                        columns: '3', style: 'plain',
                        list: [
                            { id: uid(), image: '', title: 'A name', text: 'Their role', btnText: '', btnLink: '#', tag: '', meta: '', metaIcon: '' },
                            { id: uid(), image: '', title: 'A name', text: 'Their role', btnText: '', btnLink: '#', tag: '', meta: '', metaIcon: '' },
                            { id: uid(), image: '', title: 'A name', text: 'Their role', btnText: '', btnLink: '#', tag: '', meta: '', metaIcon: '' }
                        ]
                    })
                ]]);
            }
        },
        {
            key: 'quote', label: 'A quote', icon: 'fa-quote-left', group: 'Build your own',
            style: { bg: 'paper', width: 'mid' },
            build: function () { return row('1', [[el('quote', {})]]); }
        },
        {
            key: 'video', label: 'A video', icon: 'fa-play', group: 'Build your own',
            style: { width: 'mid' },
            build: function () { return row('1', [[el('video', {})]]); }
        },
        {
            key: 'mapform', label: 'Map beside a form', icon: 'fa-map-location-dot', group: 'Build your own',
            build: function () {
                return row('1-1', [[el('map', {})], [el('form', {})]], { valign: 'stretch' });
            }
        }
    ];

    /* =================================================================
       Icon picker choices. Grouped so the CMS can show them in tabs.
       Any Font Awesome free name also works when typed by hand.
       ================================================================= */
    var ICONS = [
        { group: 'Faith', names: ['fa-cross', 'fa-church', 'fa-book-bible', 'fa-dove', 'fa-hands-praying',
            'fa-place-of-worship', 'fa-star-of-david', 'fa-candle-holder', 'fa-bell', 'fa-heart',
            'fa-hand-holding-heart', 'fa-people-group', 'fa-handshake-angle', 'fa-seedling', 'fa-fire'] },
        { group: 'People', names: ['fa-user', 'fa-user-group', 'fa-users', 'fa-child-reaching', 'fa-graduation-cap',
            'fa-person-praying', 'fa-baby', 'fa-face-smile', 'fa-user-plus', 'fa-people-carry-box'] },
        { group: 'Events', names: ['fa-calendar-day', 'fa-calendar-check', 'fa-clock', 'fa-utensils', 'fa-mug-hot',
            'fa-music', 'fa-microphone', 'fa-guitar', 'fa-cake-candles', 'fa-gift', 'fa-ticket', 'fa-bus'] },
        { group: 'Places', names: ['fa-location-dot', 'fa-map', 'fa-house', 'fa-building', 'fa-city',
            'fa-signs-post', 'fa-globe', 'fa-mountain-sun', 'fa-tree', 'fa-campground'] },
        { group: 'Contact', names: ['fa-envelope', 'fa-phone', 'fa-comments', 'fa-comment-dots', 'fa-paper-plane',
            'fa-share-nodes', 'fa-link', 'fa-at', 'fa-inbox', 'fa-bullhorn'] },
        { group: 'General', names: ['fa-star', 'fa-check', 'fa-circle-check', 'fa-arrow-right', 'fa-arrow-up-right-from-square',
            'fa-lightbulb', 'fa-flag', 'fa-compass', 'fa-hand-point-right', 'fa-quote-left', 'fa-image',
            'fa-play', 'fa-download', 'fa-circle-info', 'fa-circle-question', 'fa-chart-simple', 'fa-list-check',
            'fa-magnifying-glass', 'fa-shield-heart', 'fa-hands-holding-circle'] }
    ];

    /* =================================================================
       Factories
       ================================================================= */

    /* A fresh element of the given type. `over` supplies any settings to
       differ from the type's defaults. */
    function el(type, over) {
        var def = ELEMENTS[type];
        if (!def) return null;
        var e = clone(def.defaults);
        e.type = type;
        e.id = uid();
        if (over) for (var k in over) if (Object.prototype.hasOwnProperty.call(over, k)) e[k] = clone(over[k]);
        // Repeatable lists need ids of their own so the CMS can address a row.
        stampListIds(e);
        return e;
    }

    /* Every { id: '' } inside a repeatable list gets a real id. */
    function stampListIds(obj) {
        for (var k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            var v = obj[k];
            if (Array.isArray(v)) {
                v.forEach(function (item) {
                    if (item && typeof item === 'object') {
                        if (!item.id) item.id = uid();
                        stampListIds(item);
                    }
                });
            }
        }
        return obj;
    }

    function column(elements, over) {
        var c = {
            id: uid(),
            elements: elements || [],
            bg: 'none', bgColor: '', bgImage: '', pad: 0, radius: 0,
            border: false, shadow: false, valign: 'top'
        };
        if (over) for (var k in over) if (Object.prototype.hasOwnProperty.call(over, k)) c[k] = over[k];
        return c;
    }

    /* row('1-1', [[elA, elB], [elC]]) — one array of elements per column. */
    function row(layoutKey, columnContents, over) {
        var spec = layout(layoutKey);
        var contents = columnContents || [];
        var r = {
            id: uid(),
            layout: spec.v,
            gap: 32, valign: 'stretch', reverse: false, padTop: 0, padBottom: 0,
            columns: spec.cols.map(function (w, i) {
                return column(contents[i] || [], { width: w });
            })
        };
        if (over) for (var k in over) if (Object.prototype.hasOwnProperty.call(over, k)) r[k] = over[k];
        return r;
    }

    function newRow(layoutKey) {
        var r = row(layoutKey || '1', []);
        // A brand new row is easier to grasp with something visible in it.
        r.columns[0].elements.push(el('text', {}));
        return r;
    }

    /* A fresh section. `type` is a key of SECTIONS, or a preset key. */
    function newSection(type) {
        var presetDef = null;
        for (var i = 0; i < PRESETS.length; i++) {
            if (PRESETS[i].key === type) { presetDef = PRESETS[i]; break; }
        }

        var baseType = presetDef ? 'blocks' : type;
        var def = SECTIONS[baseType];
        if (!def) return null;

        var s = {
            id: uid(),
            type: baseType,
            show: true,
            style: merge(clone(SECTION_STYLE_DEFAULTS), def.style || {}),
            data: clone(def.defaults || {})
        };

        if (baseType === 'blocks') {
            s.data.rows = presetDef ? [presetDef.build()] : [newRow('1')];
            if (presetDef && presetDef.style) merge(s.style, presetDef.style);
            s.name = presetDef ? presetDef.label : '';
        }

        stampListIds(s.data);
        return s;
    }

    function merge(base, over) {
        for (var k in over) {
            if (Object.prototype.hasOwnProperty.call(over, k)) base[k] = over[k];
        }
        return base;
    }

    /* The name shown for a section in the CMS outline. */
    function sectionLabel(section) {
        if (!section) return 'Section';
        if (section.name) return section.name;
        var def = SECTIONS[section.type];
        return def ? def.label : section.type;
    }

    function elementLabel(element) {
        if (!element) return 'Element';
        var def = ELEMENTS[element.type];
        return def ? def.label : element.type;
    }

    global.BLOCKS = {
        /* Bumped whenever these files have to be deployed together. The page
           checks that every one of them reports the same number, so a copy
           left behind by a part-finished upload is named on screen rather
           than failing later as "x is not a function". */
        apiVersion: 2,

        sections: SECTIONS,
        elements: ELEMENTS,
        presets: PRESETS,
        layouts: LAYOUTS,
        icons: ICONS,
        sectionStyleFields: SECTION_STYLE_FIELDS,
        sectionStyleDefaults: SECTION_STYLE_DEFAULTS,
        rowFields: ROW_FIELDS,
        columnFields: COLUMN_FIELDS,
        uid: uid,
        layout: layout,
        newSection: newSection,
        newElement: el,
        newRow: newRow,
        newColumn: column,
        stampListIds: stampListIds,
        sectionLabel: sectionLabel,
        elementLabel: elementLabel
    };
})(window);
