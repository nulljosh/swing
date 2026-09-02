# Swing Technical Whitepaper

**v1.0** | September 2026

Swing is fifteen seconds of video with a stranger. Both people tap for more
time or the call ends itself; if both tap Keep they swap handles. Same idea as
Monkey and Omegle, written from scratch on Cloudflare. Live at
[swing.heyitsmejosh.com](https://swing.heyitsmejosh.com).

## Architecture

- **`worker.js`**: a Cloudflare Worker. Serves `web/` as static assets and
  hands `/ws` to a single Durable Object.
- **The lobby Durable Object**: keeps a waiting queue, pairs two sockets, and
  relays WebRTC signaling (offer, answer, ICE candidates) between them. It
  never sees audio or video. One object is enough because the lobby is a
  queue, and a queue has one head.
- **`web/chat.js`**: camera, WebSocket, and one `RTCPeerConnection` per
  stranger. Media flows peer-to-peer.
- **`web/app.html`**: the call, the countdown, the 18+ gate.

Nothing is recorded and nothing is stored. The Worker holds only live socket
state.

## The clock

Each call starts at 15 seconds. A tap from either side adds time; if the
clock reaches zero the client tears the connection down and asks the lobby
for the next stranger. Keep is a mutual flag: only when both sides set it do
handles get exchanged through the signaling channel.

## NAT traversal

`/ice` hands the browser its ICE servers. With no TURN key configured it
returns STUN only, which connects most pairs but not symmetric NATs. When
`TURN_KEY_ID` and `TURN_KEY_API_TOKEN` are set, the Worker mints a
Cloudflare TURN credential per visit with a one-hour TTL. If minting fails
the call still runs on STUN.

## Known limits

Reports are logged to the Worker console and cut the call; there is no
moderation queue. `node test.mjs` covers pairing logic.

## License

MIT 2026, Joshua Trommel
