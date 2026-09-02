# swing roadmap

- [ ] TURN: code is done and live at `/ice`; needs a TURN key created in the
      Cloudflare dashboard, then `wrangler secret put TURN_KEY_ID` and
      `TURN_KEY_API_TOKEN`. Until then it serves STUN only.
- [ ] Real abuse handling: reports go to console.log; needs a queue + ban list
      before this is publicly linked.
- [ ] Text chat alongside video (reuse the same socket, one more message type).
- [ ] Accounts, so a kept handle survives the tab closing.
- [ ] Interest/region matching, needs the lobby sharded past one DO.
- [ ] iOS/macOS wrappers, per the cross-platform rule.
