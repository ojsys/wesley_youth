# Website Manager — how to update the website

Everything on the website is edited from one place: the **Website Manager**.

Go to **`yourdomain.com/admin`** and sign in with your password.
(There's also a small *Site admin* link at the very bottom of the website.)

Bookmark that address — it's the only page you need.

---

## How editing works

1. Pick a section from the menu on the left.
2. Change whatever you like. Nothing is live yet.
3. Press **Publish changes** (top right) when you're happy.

Until you press Publish, visitors still see the old version — so you can take your
time, and a half-finished headline never appears on the real site.

The button at the top tells you where you stand:

| What it says | What it means |
|---|---|
| **All changes published** | The website matches what you see here. |
| **● Unpublished changes** | You've edited something. Press Publish. |

Tips:
- **Preview** (top right) opens the real website beside the editor. It updates *as you
  type*, so you can see exactly how a change will look before publishing.
- Press **Ctrl+S** (Windows) or **Cmd+S** (Mac) to publish.
- If you close the tab with unpublished changes, your work is kept. Next time you sign
  in it offers to bring it back.

---

## What's in the menu

**Overview**
- **Dashboard** — a summary, plus shortcuts to the things you change most.
- **Messages** — everything sent through the contact form (see below).

**Page content**
- **Home / Top section** — the first thing visitors see. Background, headline,
  welcome paragraph, the BELONG · GROW · LEAD · SERVE words, and the two buttons.
- **Vision & Mission**
- **Impact Areas** — the four cards. Exactly 4 arranges them around the emblem; any
  other number uses a plain grid.
- **Gatherings** — the event cards. Add, edit, reorder or remove them.
- **Photo Gallery** — all the photos on the site.
- **Contact & Socials** — address, phone, the contact form wording, and social links.

**Site-wide**
- **Identity & Logo** — church name, subtitle, logo, browser tab title.
- **Menu** — the links across the top of the website.
- **Footer**

**Tools**
- **Media Library** — every photo you've uploaded.
- **History** — put back an earlier version, or download a backup.
- **Settings** — where contact form messages are sent, and your password.

Every section has a **Show this section on the website** tick box, so you can hide a
whole section temporarily without deleting anything.

---

## Photos

Anywhere the editor asks for a photo, press **Choose photo**. You can either drag a
photo in from your computer or phone, or pick one you've already uploaded.

Uploaded photos are stored on the website itself and are available everywhere from
then on. JPG, PNG, GIF and WEBP up to 8 MB each.

> **Tip:** resize very large photos to about 1600px wide before uploading — the pages
> load noticeably faster.

To add several gallery photos at once, go to **Photo Gallery → Upload several at
once**, then fill in the titles and captions afterwards.

### Describing your photos

In **Media Library** each photo has two boxes under it:

- **Alt text** — a short description of what's in the picture, like *"Students sharing
  a meal together"*. Visitors who use a screen reader hear this instead of seeing the
  photo, and it shows if the image ever fails to load. It also helps Google.
- **Caption** — the words you'd normally put with the photo.

Both save the moment you click away — they describe the photo itself, so they don't
wait for **Publish changes**. Once filled in, they're offered automatically as the
title and caption whenever you add that photo to the gallery.

### The top of the page

The rotating photo slideshow has been removed — it was distracting. The top of the
page now uses a calm plain background, and photos live in the **Photo Gallery**, where
visitors can click any one to see it full size.

If you ever want a photo up there, go to **Home / Top section → Background** and
choose *One still photo behind the words*. It stays still, and the
**How much the photo is softened** slider keeps the words easy to read.

---

## Lists (gatherings, photos, impact areas, social links, menu links)

Each entry has three buttons in its header:

- **↑ ↓** move it up or down — this is the order visitors see.
- **🗑** delete it.

The **Add** button at the bottom of the list creates a new one.

---

## Social links

Facebook, Instagram and YouTube are set up out of the box. To add another
(TikTok, X, WhatsApp, GroupMe, Spotify…), pick it from the dropdown at the bottom of
**Contact & Socials** and press **Add this social**, then paste your page's link.

To remove one, press its 🗑 button.

---

## Messages from the contact form

When someone fills in the form on the website:

1. It is **emailed** to the address in **Settings → Contact form**
   (currently `odanladi@icfirstchurch.org`). Just hit Reply to answer them.
2. A copy is **always kept** under **Messages**, even if the email fails — so nothing
   is ever lost.

Unread messages show a red count next to **Messages** in the menu. Click a message to
read it, then use **Reply by email**, **Mark unread** or **Delete**.

To change where messages go, edit the address in **Settings** and press
**Save address**. Use **Send a test email** to check it arrives — remember to look in
the spam folder the first time.

---

## If something goes wrong

**History** keeps a copy of the website from every time you publish. Find the version
from before the mistake and press **Restore this version** — it goes live immediately,
and your current version is saved first so you can undo the undo.

You can also press **Download a backup** before any big change, and
**Load a backup file** to bring it back.

---

## Your password

Change it under **Settings → Password**: type the current one, then a new one of at
least 8 characters.

If you're locked out, whoever set the site up can reset it by editing `config.php` —
see **`DEPLOY-HPANEL.md`**.
