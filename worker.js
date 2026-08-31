// swing — random 1:1 video chat. The Worker serves the page and hands /ws to
// one Durable Object that pairs strangers, runs the call clock, and relays
// WebRTC signaling. Media is peer-to-peer and never touches us.

const ROUND_MS = 15000; // a call starts at 15s; both sides extend it or it ends

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      return env.LOBBY.get(env.LOBBY.idFromName("global")).fetch(request);
    }
    if (url.pathname === "/ice") return ice(env);
    return env.ASSETS.fetch(request);
  },
};

// STUN tells a browser its public address, which is enough for most pairs. The
// rest — symmetric NATs, restrictive corporate networks — need TURN to relay the
// media. Credentials are minted per client and expire, so nothing long-lived
// ever reaches the page.
const STUN = { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] };

async function ice(env) {
  const body = (servers) =>
    Response.json({ iceServers: servers }, { headers: { "cache-control": "no-store" } });

  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return body([STUN]);
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 3600 }),
      },
    );
    if (!res.ok) throw new Error(`turn ${res.status}`);
    const data = await res.json();
    const servers = data.iceServers ? [].concat(data.iceServers) : [];
    return body([STUN, ...servers]);
  } catch (err) {
    // A relay we could not mint is not worth failing the call over; the pairs
    // that STUN can serve still connect.
    console.log("turn", String(err));
    return body([STUN]);
  }
}

export class Lobby {
  constructor(state) {
    this.state = state;
    this.queue = [];          // sockets waiting for a partner, oldest first
    this.who = new Map();     // socket -> { handle, last, pair }
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.who.set(server, { handle: "", last: null, pair: null });
    server.addEventListener("message", (e) => this.onMessage(server, e.data));
    server.addEventListener("close", () => this.drop(server));
    server.addEventListener("error", () => this.drop(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(ws, raw) {
    const me = this.who.get(ws);
    if (!me) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // ignore junk from the wire
    }
    switch (msg.type) {
      case "find":
        me.handle = clean(msg.handle);
        this.find(ws);
        break;
      case "signal": {
        const peer = this.peerOf(ws);
        if (peer) send(peer, { type: "signal", data: msg.data });
        break;
      }
      case "extend":
        this.vote(ws, "extend");
        break;
      case "keep":
        this.vote(ws, "keep");
        break;
      case "report":
        // No media passes through us, so a report can only cut the pair and
        // leave a trace. ponytail: console.log is the whole moderation story —
        // wire to a real abuse queue before this is linked anywhere public.
        console.log("report", JSON.stringify(clean(msg.reason, 200)));
        this.end(ws, "reported");
        break;
      case "next":
        this.end(ws, "skipped");
        this.find(ws);
        break;
    }
  }

  peerOf(ws) {
    const pair = this.who.get(ws)?.pair;
    if (!pair) return null;
    return pair.a === ws ? pair.b : pair.a;
  }

  find(ws) {
    const me = this.who.get(ws);
    if (!me || me.pair || this.queue.includes(ws)) return;
    // Take the oldest waiting stranger who isn't the person we just left —
    // otherwise a timed-out pair instantly rematches with each other.
    const i = this.queue.findIndex((o) => o !== ws && o !== me.last && open(o));
    if (i === -1) {
      this.queue.push(ws);
      send(ws, { type: "waiting" });
      return;
    }
    const peer = this.queue.splice(i, 1)[0];
    const pair = { a: peer, b: ws, extend: new Set(), keep: new Set(), timer: null };
    this.who.get(peer).pair = pair;
    me.pair = pair;
    // Whoever was already waiting makes the offer; the newcomer answers.
    send(peer, { type: "matched", initiator: true, ms: ROUND_MS });
    send(ws, { type: "matched", initiator: false, ms: ROUND_MS });
    this.arm(pair);
  }

  // The clock is the product: a call dies at the deadline unless both sides
  // asked for more, so it is kept server-side where neither client can stall it.
  arm(pair) {
    clearTimeout(pair.timer);
    pair.timer = setTimeout(() => {
      const { a, b } = pair;
      this.unpair(pair);
      for (const ws of [a, b]) {
        send(ws, { type: "time-up" });
        this.find(ws);
      }
    }, ROUND_MS);
  }

  vote(ws, kind) {
    const pair = this.who.get(ws)?.pair;
    if (!pair) return;
    const peer = this.peerOf(ws);
    pair[kind].add(ws);
    if (pair[kind].size < 2) {
      send(peer, { type: "asked", what: kind });
      return;
    }
    if (kind === "extend") {
      pair.extend.clear();
      for (const side of [pair.a, pair.b]) send(side, { type: "extended", ms: ROUND_MS });
      this.arm(pair);
    } else {
      // Both said keep, so each one gets the other's handle. Nothing is
      // exchanged unless both asked for it.
      send(pair.a, { type: "kept", handle: this.who.get(pair.b).handle });
      send(pair.b, { type: "kept", handle: this.who.get(pair.a).handle });
    }
  }

  unpair(pair) {
    clearTimeout(pair.timer);
    for (const side of [pair.a, pair.b]) {
      const meta = this.who.get(side);
      if (meta) {
        meta.pair = null;
        meta.last = side === pair.a ? pair.b : pair.a;
      }
    }
  }

  // One side walked. Break the pair and tell the other, leaving both free.
  end(ws, reason) {
    const pair = this.who.get(ws)?.pair;
    if (!pair) return;
    const peer = this.peerOf(ws);
    this.unpair(pair);
    send(peer, { type: "peer-left", reason });
  }

  drop(ws) {
    const i = this.queue.indexOf(ws);
    if (i !== -1) this.queue.splice(i, 1);
    this.end(ws, "left");
    this.who.delete(ws);
  }
}

// Handles and reasons are user text going straight back out to a stranger.
function clean(s, max = 32) {
  if (typeof s !== "string") return "";
  return s.replace(/[\p{C}]/gu, "").trim().slice(0, max);
}

const open = (ws) => ws.readyState === 1;

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    // socket already gone; drop() cleans up
  }
}
