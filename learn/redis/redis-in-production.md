# Redis in production: one node, replicas, Sentinel, Cluster
> Grow from one node only when needed: replicas for reads and failover, Sentinel to promote a replica, Cluster to split data across nodes.

**Problem:** one Redis is a single point of failure, and one node's RAM is the ceiling.

**How:**
- **Single node + AOF:** our launch setup. Simple; a restart means seconds of "not ready".
- **Replica + Sentinel:** a copy follows the primary; Sentinel promotes it if the primary dies. Replication is async, so the last writes can be lost on failover.
- **Cluster:** keys are split into 16,384 hash slots across primaries. Commands and scripts that touch several keys need them in **one slot**: put the shared part in braces, `mm:{BUZZER}:queue` and `mm:{BUZZER}:ticket:…`.
- **Security:** never expose it to the internet (compose binds `127.0.0.1`), use a password/ACL, and TLS when it is on another machine.

**In our code:** single node in [docker-compose.yml](../../docker-compose.yml). Our scripts are single-node style: `TAKE_OLDEST_PAIR` builds ticket key names inside the script, but Redis Cluster requires every key a script touches to be passed in `KEYS` and to live in one slot. Fine today; to change before any Cluster move.

**Watch out:** licensing. From 7.4, Redis is source-available (RSALv2/SSPLv1; Redis 8 adds AGPLv3). Using it inside our own app is allowed. Valkey is the Linux Foundation's BSD-licensed fork.

**Check yourself:** why is "add Cluster" not a config switch for our matchmaking code?
<details><summary>Answer</summary>Cluster needs every key a script uses declared in `KEYS` and stored in one hash slot. Our scripts derive ticket keys at runtime and use separate key names, so key naming and scripts must change first.</details>
