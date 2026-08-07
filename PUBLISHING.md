# Putting the site online

GitHub Pages hosts the files for free; Cloudflare points the domain at it. This
is the whole setup, in order.

> **Check the domain first.** Everything below assumes
> **`thirstybearstudios.com`**. If the domain on your Cloudflare account is
> spelled differently, fix it in the `CNAME` file at the top of this folder
> before you start — that file has to match the domain exactly, and a mismatch
> is the single most common way this goes wrong.

Steps 1–3 are done once. After that, updating the site is step 6 and nothing
else.

---

## 1–2. Account and repository — done

The repository is <https://github.com/teenacanfield-blip/TBS>. It is public,
which is what GitHub Pages needs on a free account, and empty, which is what a
first push needs.

## 3. Push this folder up

Also done, apart from the push itself. Git is initialised, everything is
committed, `origin` points at the repository above, and the branch is `main`.

That leaves one command, run in this folder:

```bash
git push -u origin main
```

If it asks you to sign in, a browser window is the easiest way. If it asks for a
password instead, that is a *personal access token*, not your account password —
GitHub's sign-in page walks you through making one.

## 4. Turn Pages on

In the repository: **Settings → Pages**. Under *Build and deployment*, set
**Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`, and
**Save**.

Wait a minute or two. The site appears at:

```
https://teenacanfield-blip.github.io/TBS/
```

**Check this address works before touching the domain.** If the hub loads here,
the hosting is fine and anything that goes wrong later is DNS.

## 5. Point the domain at it — Cloudflare

Cloudflare dashboard → your domain → **DNS → Records**. Delete any existing `A`
or `CNAME` record on `@` or `www` first, then add these five:

| Type | Name | Content | Proxy status |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | **DNS only** |
| A | `@` | `185.199.109.153` | **DNS only** |
| A | `@` | `185.199.110.153` | **DNS only** |
| A | `@` | `185.199.111.153` | **DNS only** |
| CNAME | `www` | `teenacanfield-blip.github.io` | **DNS only** |

### The two Cloudflare settings that break this

**Set the proxy to "DNS only" — the grey cloud, not the orange one.** Click the
cloud icon on each record until it says *DNS only*. With the orange cloud on,
GitHub cannot verify you own the domain and issuing the HTTPS certificate fails.
You can switch the orange cloud back on later, once step 6 has finished and
HTTPS is working, if you want Cloudflare's caching.

**If you do turn the proxy on later, set SSL/TLS mode to "Full".** It is under
**SSL/TLS → Overview**. The default on some accounts is *Flexible*, which with
GitHub Pages causes an endless redirect loop — the page reloads forever and
never appears. *Full* fixes it.

## 6. Tell GitHub about the domain

Back in **Settings → Pages**, put `thirstybearstudios.com` in *Custom domain*
and press Save. GitHub checks DNS, which can take a few minutes.

Once the check passes, a **Enforce HTTPS** tickbox becomes available. Tick it.
If it is greyed out, the certificate is still being issued — wait and come back;
it can take up to an hour.

DNS changes take anywhere from a few minutes to a day to spread. After that,
typing `thirstybearstudios.com` opens the hub.

---

## Updating the site later

After you change anything:

```bash
powershell -ExecutionPolicy Bypass -File bump-version.ps1
```

```bash
git add -A
```

```bash
git commit -m "Update"
```

```bash
git push
```

The bump step matters. Browsers hold on to old copies of `game.js` and
`style.css`; bumping the version number changes the file addresses so every
browser fetches the new ones. Without it, some players keep seeing the old game.

The live site updates about a minute after the push.

## If something is wrong

**The github.io address 404s.** Pages is not on yet, or is set to the wrong
branch. Re-check step 4.

**The domain shows a 404 but github.io works.** GitHub does not know about the
domain — either the `CNAME` file is missing from the repository, or its contents
do not exactly match what is in *Custom domain*.

**The page reloads forever.** Cloudflare SSL/TLS is set to *Flexible*. Set it to
*Full*.

**"Domain does not resolve to the GitHub Pages server."** DNS has not spread
yet, or the records are still proxied. Give it an hour, and check the clouds are
grey.

**The four 3D demos are blank, everything else works.** Those load `three.js`
from a CDN. The network is blocking it — see `demos/README.md`.

## Being found on Google

Typing the address works the moment DNS is live. Coming up in a *search* is a
separate, slower thing: Google has to find the site, decide it is worth listing,
and rank it. That takes weeks and is never guaranteed.

What helps:

- The pages already have real titles, descriptions and share tags. That is most
  of the technical side.
- Submit the domain once at <https://search.google.com/search-console>.
- Links from anywhere real — an itch.io page, a YouTube description, a Discord
  server — matter more than anything you can change in the HTML.

Until it is indexed, share the link itself. That always works.
