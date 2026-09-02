// Client half of the loop: hold the camera, talk to the lobby socket, rebuild
// one RTCPeerConnection per stranger, and mirror the server's call clock.

const FALLBACK_ICE = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

// The server mints short-lived TURN credentials per visit. Fetched once when the
// camera starts, not per stranger, and a failure just means STUN-only.
async function iceServers() {
  try {
    const res = await fetch("/ice");
    const data = await res.json();
    return data.iceServers?.length ? data.iceServers : FALLBACK_ICE;
  } catch {
    return FALLBACK_ICE;
  }
}

export class Chat {
  constructor({ local, remote, onState, onClock, onAsked, onKept, onChat }) {
    this.localEl = local;
    this.remoteEl = remote;
    this.onState = onState || (() => {});
    this.onClock = onClock || (() => {});
    this.onAsked = onAsked || (() => {});
    this.onKept = onKept || (() => {});
    this.onChat = onChat || (() => {});
    this.handle = "";
    this.stream = null;
    this.ws = null;
    this.pc = null;
    this.tick = null;
    this.set("idle");
  }

  set(state, note) {
    this.state = state;
    this.onState(state, note);
  }

  async start(handle) {
    if (this.state !== "idle") return;
    this.handle = handle || "";
    this.ice = FALLBACK_ICE;
    this.set("idle", "Requesting camera...");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      this.set("idle", "Camera or microphone blocked");
      return;
    }
    this.localEl.srcObject = this.stream;
    this.ice = await iceServers();
    this.connect();
  }

  connect() {
    const url = new URL("/ws", location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.find();
    this.ws.onmessage = (e) => this.onServer(JSON.parse(e.data));
    this.ws.onclose = () => {
      if (this.state !== "idle") this.stop("Disconnected");
    };
    this.set("searching", "Looking for someone...");
  }

  find() {
    this.send({ type: "find", handle: this.handle });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  async onServer(msg) {
    switch (msg.type) {
      case "waiting":
        this.set("searching", "Looking for someone...");
        break;
      case "matched":
        await this.openPeer(msg.initiator);
        this.runClock(msg.ms);
        break;
      case "signal":
        await this.onSignal(msg.data);
        break;
      case "asked":
        this.onAsked(msg.what);
        break;
      case "extended":
        this.runClock(msg.ms);
        this.onAsked(null);
        break;
      case "kept":
        this.onKept(msg.handle);
        break;
      case "chat":
        this.onChat(msg.text);
        break;
      case "time-up":
        this.reset("Time ran out. Looking for someone...");
        break;
      case "peer-left":
        this.reset("Stranger left. Looking for someone...");
        this.find();
        break;
    }
  }

  // Display only — the server owns the real deadline and ends the call itself.
  runClock(ms) {
    clearInterval(this.tick);
    const end = Date.now() + ms;
    const paint = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      this.onClock(left);
      if (left === 0) clearInterval(this.tick);
    };
    paint();
    this.tick = setInterval(paint, 250);
  }

  async openPeer(initiator) {
    this.closePeer();
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    this.pc = pc;
    for (const track of this.stream.getTracks()) pc.addTrack(track, this.stream);
    pc.ontrack = (e) => {
      this.remoteEl.srcObject = e.streams[0];
      this.set("connected", "Connected");
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ type: "signal", data: { candidate: e.candidate } });
    };
    this.set("connecting", "Connecting...");
    if (initiator) {
      await pc.setLocalDescription(await pc.createOffer());
      this.send({ type: "signal", data: { sdp: pc.localDescription } });
    }
  }

  async onSignal(data) {
    const pc = this.pc;
    if (!pc) return;
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === "offer") {
        await pc.setLocalDescription(await pc.createAnswer());
        this.send({ type: "signal", data: { sdp: pc.localDescription } });
      }
    } else if (data.candidate) {
      // Candidates can land before the remote description on a slow link.
      try { await pc.addIceCandidate(data.candidate); } catch {}
    }
  }

  closePeer() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteEl.srcObject = null;
  }

  reset(note) {
    clearInterval(this.tick);
    this.closePeer();
    this.onClock(null);
    this.onAsked(null);
    this.set("searching", note);
  }

  say(text) { if (this.state === "connected" && text) this.send({ type: "chat", text }); }
  extend() { this.send({ type: "extend" }); }
  keep() { this.send({ type: "keep" }); }

  next() {
    this.reset("Looking for someone...");
    this.send({ type: "next" });
  }

  report(reason) {
    this.send({ type: "report", reason });
    this.reset("Reported. Looking for someone...");
    this.find();
  }

  stop(note) {
    clearInterval(this.tick);
    this.closePeer();
    this.onClock(null);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    this.localEl.srcObject = null;
    this.set("idle", note || "Idle");
  }
}
