# Architecture

Random 1:1 video chat. One-tap to connect, video/audio via WebRTC, no sign-up, no history. Durable Object handles the lobby (match-making).

## How it runs

On load, user enters a 4-digit room code (or random). Visits the same Durable Object URL. DO backend matches two visitors and hands them STUN/TURN server addresses. WebRTC peer connection opens. Video/audio stream. Hang up. Conversation never leaves the browser; server sees no content.

| File | What it owns |
|---|---|
| `index.html` | Landing page + app. Video elements, room code input, toggle mute/video, hang up button. Webrtc peer connection code. |
| `worker.js` | Durable Object: lobby state, matching two visitors, serving STUN/TURN config. |
| `wrangler.toml` | Cloudflare deployment, DO binding. |
