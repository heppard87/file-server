## 2025-05-14 - [Shared Directory Watchers]
**Learning:** Creating a separate `chokidar` watcher for every file served is a major resource bottleneck. Implementing a shared, reference-counted watcher system and using directory-level watching for `serveDirectory` significantly reduces OS overhead and memory usage.
**Action:** Always look for opportunities to consolidate file system watchers into directory-level watchers when multiple files in the same subtree are being managed.

## 2025-05-14 - [Watcher Reference Counting]
**Learning:** When sharing watchers across multiple instances, simple global registry is not enough. You need reference counting to know when it's safe to close the watcher. Also, all instances must be notified of changes, not just the one that created the watcher.
**Action:** Use a `Set` of listeners/instances per watched path in a shared registry.

## 2025-05-14 - [Test Mock Synchronicity]
**Learning:** Some test mocks (like for `chokidar`) may call event listeners synchronously during the `on()` call. If the internal state (like adding to a Set of servers) is updated AFTER the `on()` call, the listener will miss the update and fail.
**Action:** Ensure all state registration is complete BEFORE attaching event listeners to dependencies that might trigger synchronous callbacks.
