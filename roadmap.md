# swing roadmap

- [x] Solo automated call QA: two Chrome contexts with fake camera and mic
      connected, carried audio/video, chat, extend, keep, next, and disconnect.
      A real iPhone-to-device call remains untested.
- [ ] TURN: `/ice` still serves STUN only. Creating the key requires a Cloudflare
      API token with Calls Write, then `TURN_KEY_ID` and `TURN_KEY_API_TOKEN`
      Worker secrets. Current Wrangler OAuth and DNS token lack that permission.
- [x] Reports persist in the Durable Object; three distinct reports within a
      day trigger a temporary ban. The protected moderation endpoint lists the
      queue and bans; its token is stored in macOS Keychain.
- [ ] Accounts, so a kept handle survives the tab closing.
- [ ] Interest/region matching, needs the lobby sharded past one DO.
- [ ] iOS/macOS wrappers, per the cross-platform rule.
