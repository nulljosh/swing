# Swing

**Live:** https://swing.heyitsmejosh.com

Fifteen seconds of video with a stranger.

Both of you tap for more time or the call ends itself. Both tap Keep and you swap
handles. Same idea as Monkey and Omegle. Written from scratch.

- `worker.js`: a Cloudflare Worker. Serves `web/` and hands `/ws` to one
  Durable Object. That object keeps the queue, pairs two sockets, and relays
  WebRTC signaling. It never sees audio or video.
- `web/chat.js`: camera, socket, one `RTCPeerConnection` per stranger.
- `web/index.html`: the landing page. `web/app.html`: the call, the clock,
  and the 18+ gate.

Video and audio go straight between the two browsers. Nothing is recorded. Nothing is stored.

## Run

    npx wrangler dev      # http://localhost:8787, open two tabs
    node test.mjs         # pairing logic
    npx wrangler deploy

## TURN

`/ice` hands the browser its ICE servers. With no TURN key it returns STUN only.
That connects most pairs. Symmetric NATs it does not. To turn the relay on, make
a TURN key in the Cloudflare dashboard (Realtime > TURN) and give the Worker both values:

    npx wrangler secret put TURN_KEY_ID
    npx wrangler secret put TURN_KEY_API_TOKEN

The Worker then mints a credential per visit that lives one hour. Nothing
long-lived reaches the page. If minting fails, the call runs on STUN instead of
failing.

## Known limits

A report cuts the call and logs to the Worker console. That's it. No abuse
queue, no ban list, no moderation. One lobby for everyone, so no interest tags
and no region matching.
