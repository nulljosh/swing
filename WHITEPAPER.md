# Swing Technical Whitepaper

**v1.0** | September 2026

Random video chat used to mean Chatroulette and Omegle: no timer, no exit
built in, and a call that drags on past the point either side wants it to.
Swing fixes that by making the awkward exit automatic. It is fifteen seconds
of video with a stranger. Both people tap for more
time or the call ends itself; if both tap Keep they swap handles. Same idea as
Monkey and Omegle, written from scratch on Cloudflare because there was no
reason to run a video app on anything heavier than a Worker and a Durable
Object. Live at
[swing.heyitsmejosh.com](https://swing.heyitsmejosh.com).

## Architecture

- **`worker.js`**: a Cloudflare Worker. Serves `web/` as static assets and
  hands `/ws` to a single Durable Object.
- **The lobby Durable Object**: keeps a waiting queue, pairs two sockets, and
  relays WebRTC signaling (offer, answer, ICE candidates) between them. It
  never sees audio or video, because signaling is metadata and media is
  content, and only one of those needs to touch a server at all. One object is
  enough because the lobby is a queue, and a queue has one head.
- **`web/chat.js`**: camera, WebSocket, and one `RTCPeerConnection` per
  stranger. Media flows peer-to-peer, because routing two strangers' video
  through a server would cost bandwidth for something a direct connection
  already does for free.
- **`web/app.html`**: the call, the countdown, the 18+ gate.

Nothing is recorded and nothing is stored, because a random call with a
stranger is exactly the kind of thing nobody wants sitting on a server
afterward. The Worker holds only live socket state.

## The clock

Each call starts at 15 seconds, short enough that saying no to a second round
costs nothing. A tap from either side adds time; if the
clock reaches zero the client tears the connection down and asks the lobby
for the next stranger. Keep is a mutual flag: only when both sides set it do
handles get exchanged through the signaling channel, so wanting to keep
talking to someone who does not want to keep talking to you never leaks their
handle.

## NAT traversal

`/ice` hands the browser its ICE servers. With no TURN key configured it
returns STUN only, which connects most pairs but not symmetric NATs. When
`TURN_KEY_ID` and `TURN_KEY_API_TOKEN` are set, the Worker mints a
Cloudflare TURN credential per visit with a one-hour TTL, short-lived because a
long-lived relay credential is a bigger thing to leak than the call it
serves. If minting fails
the call still runs on STUN rather than failing outright, since most pairs
never needed TURN in the first place.

## Known limits

Reports are logged to the Worker console and cut the call; there is no
moderation queue. `node test.mjs` covers pairing logic.

## License

MIT 2026, Joshua Trommel
