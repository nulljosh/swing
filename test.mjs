// One runnable check on the only real logic here: who gets paired with whom,
// that the clock ends a call nobody extended, and that handles are swapped
// only when both sides ask.
import assert from "node:assert";
import { Lobby } from "./worker.js";

const fake = (name) => ({ name, readyState: 1, sent: [], send(s) { this.sent.push(JSON.parse(s)); } });
const last = (ws) => ws.sent.at(-1);
const msg = (lobby, ws, o) => lobby.onMessage(ws, typeof o === "string" ? o : JSON.stringify(o));

// Hold the pair timers instead of waiting 15 real seconds for one.
const timers = [];
globalThis.setTimeout = (fn) => (timers.push(fn), timers.length);
globalThis.clearTimeout = () => {};

const lobby = new Lobby({});
const [a, b, c] = ["a", "b", "c"].map(fake);
for (const ws of [a, b, c]) lobby.who.set(ws, { handle: "", last: null, pair: null });

msg(lobby, a, { type: "find", handle: " @ana  " });
assert.equal(last(a).type, "waiting");
assert.equal(lobby.who.get(a).handle, "@ana", "handle is trimmed");

msg(lobby, b, { type: "find", handle: "@bo" });
assert.deepEqual(last(a), { type: "matched", initiator: true, ms: 15000 });
assert.deepEqual(last(b), { type: "matched", initiator: false, ms: 15000 });

// Signals reach the partner and nobody else.
msg(lobby, a, { type: "signal", data: { sdp: "x" } });
assert.deepEqual(last(b), { type: "signal", data: { sdp: "x" } });

// Chat text reaches the partner, trimmed and capped, and empty text is dropped.
msg(lobby, a, { type: "chat", text: "  hi there " });
assert.deepEqual(last(b), { type: "chat", text: "hi there" });
msg(lobby, a, { type: "chat", text: "   " });
assert.deepEqual(last(b), { type: "chat", text: "hi there" }, "blank chat is not relayed");
assert.ok(msg(lobby, a, { type: "chat", text: "x".repeat(400) }) === undefined && last(b).text.length <= 280);

// One-sided votes only nudge the other side; they never take effect.
msg(lobby, a, { type: "extend" });
assert.deepEqual(last(b), { type: "asked", what: "extend" });
msg(lobby, a, { type: "keep" });
assert.deepEqual(last(b), { type: "asked", what: "keep" });
assert.ok(!a.sent.some((m) => m.type === "kept"), "no handle leaks on a one-sided keep");

// Both sides: time is added, and handles cross.
msg(lobby, b, { type: "extend" });
assert.deepEqual(last(a), { type: "extended", ms: 15000 });
msg(lobby, b, { type: "keep" });
assert.deepEqual(last(a), { type: "kept", handle: "@bo" });
assert.deepEqual(last(b), { type: "kept", handle: "@ana" });

// The clock ends a call nobody extended, and neither is rematched to the other.
msg(lobby, c, { type: "find", handle: "@cy" });
timers.at(-1)();
assert.equal(a.sent.at(-2).type, "time-up");
assert.equal(last(a).type, "matched", "a is rematched with the waiting c");
assert.equal(last(c).type, "matched");
assert.equal(last(b).type, "waiting", "b is not handed straight back to a");

// Leaving frees the partner, and junk on the wire is ignored, not thrown.
lobby.drop(a);
assert.deepEqual(last(c), { type: "peer-left", reason: "left" });
msg(lobby, c, "{not json");

console.log("ok");
