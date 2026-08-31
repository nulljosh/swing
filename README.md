# Swing

**Live:** https://swing.heyitsmejosh.com

Fifteen seconds of video with a stranger. Both of you tap for more time or the
call ends itself, and if you both tap Keep you swap handles. Same idea as
Monkey and Omegle, written from scratch.

- `worker.js` — Cloudflare Worker. Serves `web/`, and hands `/ws` to a single
  Durable Object that keeps a waiting queue, pairs two sockets, and relays
  WebRTC signaling. It never sees audio or video.
- `web/chat.js` — camera, socket, and one `RTCPeerConnection` per stranger.
- `web/index.html` — landing page. `web/app.html` — the call itself, the clock,
  and the 18+ gate.

Video and audio are peer-to-peer. Nothing is recorded and nothing is stored.

## Run

    npx wrangler dev      # http://localhost:8787, open two tabs
    node test.mjs         # pairing logic
    npx wrangler deploy

## TURN

`/ice` hands the browser its ICE servers. With no TURN key configured it returns
STUN only, which is enough for most pairs but leaves symmetric NATs unable to
connect. To turn the relay on, create a TURN key in the Cloudflare dashboard
(Realtime > TURN) and give the Worker its two values:

    npx wrangler secret put TURN_KEY_ID
    npx wrangler secret put TURN_KEY_API_TOKEN

The Worker then mints a credential per visit with a one hour TTL; nothing
long-lived is ever sent to the page. If minting fails the call still runs on
STUN rather than erroring.

## Known limits

Reports are logged to the Worker console and cut the call; there is no abuse
queue, no ban list, and no moderation of any kind. Everyone shares one lobby,
so there are no interest tags or region matching.
