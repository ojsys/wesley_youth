/* =====================================================================
   Shared content model for the First UMC & Wesley Foundation website.

   Loaded by BOTH index.html (the public site) and admin.html (the CMS), so
   the two can never drift apart. Everything an admin can edit lives here.

   Exposes:
     SITE.defaults          the built-in starting content
     SITE.socialPresets     the social networks offered in the CMS
     SITE.clone(obj)
     SITE.merge(base, over)
     SITE.normalise(obj)    fills in missing keys + upgrades older saved data
   ===================================================================== */
(function (global) {
    'use strict';

    var DEFAULTS = {
        brand: {
            logoImage: '',
            navLogoScale: 100,      // size of the logo in the top bar, as a % of normal
            logoScale: 100,         // size of the logo everywhere else, as a % of normal
            showTitle: true,        // the church name beside the logo, top of the page
            showSubtitle: true,     // the small line under it
            titleFull: 'First United Methodist Church & Wesley Foundation',
            subtitle: 'Campus Ministry · Iowa City',
            browserTitle: 'First United Methodist Church & Wesley Foundation — Iowa City'
        },

        nav: {
            links: [
                { label: 'Vision',     href: '#vision' },
                { label: 'Impact',     href: '#impact' },
                { label: 'Gatherings', href: '#gather' },
                { label: 'Gallery',    href: '#gallery' }
            ],
            ctaText: 'Join Us',
            ctaLink: '#connect'
        },

        hero: {
            /* 'plain'  = flat cream background (calm, no moving photos)
               'image'  = one still photo behind a soft veil               */
            background: 'plain',
            bgImage: '',
            bgOverlay: 78,          // how much the veil hides the photo, 0-100
            showEmblem: true,
            showScene: true,        // the illustrated skyline along the bottom
            kicker: 'Campus Ministry · Iowa City',
            title: 'First United Methodist Church & Wesley Foundation',
            titleSub: 'A community of faith at the heart of campus',
            line1: 'Grace for Today.',
            line2: 'Impact for Tomorrow.',
            sub: "No perfect people required. Free dinner every Wednesday, honest conversations, and a family that meets you exactly where you are — figuring out life, faith, and everything in between.",
            values: ['Belong', 'Grow', 'Lead', 'Serve'],
            btn1Text: "See What's On", btn1Link: '#gather',  btn1Icon: 'fa-calendar-day',
            btn2Text: 'Come As You Are', btn2Link: '#connect', btn2Icon: 'fa-comments'
        },

        vm: {
            show: true,
            label: 'Why We Exist',
            titleMain: 'Vision', titleAccent: '& Mission',
            visionTitle: 'Vision',
            visionText: 'To be a community of faith through which grace is offered to all — and each person is empowered to impact the world for good.',
            missionTitle: 'Mission',
            missionText: 'Our mission is to be disciples of Jesus Christ for the transformation of the world.'
        },

        impact: {
            show: true,
            label: 'How We Live It Out',
            titleMain: 'Our Four', titleAccent: 'Impact Areas',
            intro: 'Four ways we grow together and turn faith into action — on campus and beyond.',
            areas: [
                { icon: 'fa-people-group',       title: 'Building Beloved Community',        text: 'We cultivate belonging, hospitality, and relationships rooted in love and grace for all.' },
                { icon: 'fa-book-bible',         title: 'Spiritual Growth',                  text: 'We nurture faith through worship, study, reflection, and practices that deepen our relationship with God.' },
                { icon: 'fa-flag',               title: 'Leadership Development',            text: 'We equip and empower students to discover their gifts and lead with courage, integrity, and purpose.' },
                { icon: 'fa-hand-holding-heart', title: 'Faithful Service & Social Justice', text: 'We respond to the needs of the world through service, advocacy, and working for justice and peace.' }
            ]
        },

        gather: {
            show: true,
            label: 'This Week',
            titleMain: 'Come', titleAccent: 'Gather.',
            intro: "Free food. Real talk. Good people. Everyone's welcome at the table.",
            items: [
                { image: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&h=600&fit=crop', tag: 'Every Wednesday', time: 'Wednesdays · 6:30 PM', title: 'Wednesday Night Reset', desc: 'Dinner, fellowship, and real conversation. No homework required — just show up hungry for food and for community.', location: '120 N. Dubuque St.', btnText: "I'm Coming", btnLink: '#connect' },
                { image: 'https://images.unsplash.com/photo-1519491050282-cf00c82424ae?w=800&h=600&fit=crop', tag: 'Every Sunday', time: 'Sundays · 8:30 & 10:30 AM', title: 'Sunday Morning Worship', desc: "Start your week with music, message, and a community that actually cares how you're doing.", location: '214 E. Jefferson St.', btnText: 'Learn More', btnLink: '#connect' },
                { image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop', tag: 'Coming Soon', time: 'TBA — Stay Tuned', title: 'Retreats & Special Events', desc: "Game nights, pasta making, tie blankets, Christmas parties, mission trips — there's always something brewing.", location: 'Various Locations', btnText: 'Get Notified', btnLink: '#connect' }
            ]
        },

        gallery: {
            show: true,
            layout: 'grid',         // 'grid' = tidy photo gallery, 'strip' = swipe row
            label: 'The Moments',
            titleMain: 'This Is', titleAccent: 'Us.',
            intro: 'Real students. Real moments. Real community.',
            items: [
                { image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=1000&fit=crop', title: 'Wednesday Night',     desc: 'Good food, better people' },
                { image: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=800&h=1000&fit=crop', title: 'Christmas Party',      desc: 'Joy, laughter & ugly sweaters' },
                { image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=1000&fit=crop', title: 'Making Tie Blankets', desc: 'Crafting warmth for those in need' },
                { image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=1000&fit=crop', title: 'Pasta Making',         desc: 'Handmade with love (and flour)' },
                { image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=1000&fit=crop', title: 'Worship Night',      desc: 'Music that moves the soul' },
                { image: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&h=1000&fit=crop', title: 'Study & Chill',      desc: 'Coffee, books & good company' }
            ]
        },

        connect: {
            show: true,
            label: 'Reach Out',
            titleMain: "Let's", titleAccent: 'Connect.',
            sub: "Got questions, doubts, or just want to know where the free food is? We'd love to hear from you. No spam, no pressure — just real people ready to welcome you in.",
            address: '120 N. Dubuque Street, Iowa City, IA',
            email: 'wesley@icfirstchurch.org',
            phone: '(319) 337-2021',
            formTitle: 'Send us a message',
            formNote: "We usually reply within a day or two.",
            socials: [
                { label: 'Facebook',  icon: 'fab fa-facebook-f', url: 'https://facebook.com/' },
                { label: 'Instagram', icon: 'fab fa-instagram',  url: 'https://instagram.com/' },
                { label: 'YouTube',   icon: 'fab fa-youtube',    url: 'https://youtube.com/' }
            ]
        },

        footer: {
            tag1: 'Grace for Today.',
            tag2: 'Impact for Tomorrow.',
            values: ['Belong', 'Grow', 'Lead', 'Serve'],
            meta1: 'First United Methodist Church & Wesley Foundation · Campus Ministry, Iowa City',
            meta2: 'Disciples of Jesus Christ for the transformation of the world.',
            showSocials: true
        }
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

    /* Turn anything we load (including content saved by the old editor) into
       the current shape, filling any gap with the default. */
    function normalise(saved) {
        var out = merge(clone(DEFAULTS), saved || {});

        // The hero used to be a rotating photo slider. It isn't any more:
        // keep the first photo as an optional still background, drop the rest.
        if (saved && saved.hero && Array.isArray(saved.hero.slides)) {
            delete out.hero.slides;
        }

        // Logo sizes are percentages; keep them sane whatever was saved. The
        // top bar has its own, and allows a much bigger logo than the rest.
        function pct(v, min, max) {
            var n = parseFloat(v);
            if (!isFinite(n)) n = 100;
            return Math.min(max, Math.max(min, Math.round(n)));
        }
        out.brand.navLogoScale = pct(out.brand.navLogoScale, 50, 500);
        out.brand.logoScale    = pct(out.brand.logoScale, 50, 200);

        // Socials used to be four fixed fields. Turn them into the list.
        if (!saved || !saved.connect || !Array.isArray(saved.connect.socials)) {
            var legacy = (saved && saved.connect) || {};
            var real = function (u) { return u && u !== '#'; };
            if (real(legacy.facebook) || real(legacy.instagram)) {
                out.connect.socials = [];
                if (real(legacy.facebook))  out.connect.socials.push({ label: 'Facebook',  icon: 'fab fa-facebook-f', url: legacy.facebook });
                if (real(legacy.instagram)) out.connect.socials.push({ label: 'Instagram', icon: 'fab fa-instagram',  url: legacy.instagram });
                out.connect.socials.push({ label: 'YouTube', icon: 'fab fa-youtube', url: 'https://youtube.com/' });
            }
        }
        ['facebook', 'instagram', 'groupme', 'newsletter'].forEach(function (k) {
            delete out.connect[k];
        });

        // Guard against half-filled lists so the page can never crash.
        out.connect.socials = (out.connect.socials || []).filter(function (s) { return s && s.label; });
        out.nav.links       = (out.nav.links || []).filter(function (l) { return l && l.label; });
        ['impact.areas', 'gather.items', 'gallery.items'].forEach(function (path) {
            var p = path.split('.');
            if (!Array.isArray(out[p[0]][p[1]])) out[p[0]][p[1]] = [];
        });

        return out;
    }

    global.SITE = {
        defaults: DEFAULTS,
        socialPresets: SOCIAL_PRESETS,
        clone: clone,
        merge: merge,
        normalise: normalise
    };
})(window);
