# Swing

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

## Known limits

Reports are logged to the Worker console and cut the call; there is no abuse
queue, no ban list, and no moderation of any kind. Everyone shares one lobby,
so there are no interest tags or region matching. Peers behind strict NATs will
fail to connect because there is no TURN server, only STUN.
