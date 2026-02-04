## 2026-02-04 - [Shared Directory Watchers]
**Learning:** Consolidating file-level watchers into directory-level watchers (depth: 0) with a shared reference-counted system significantly reduces resource overhead and setup time (up to 92% for large file sets). It also ensures consistent cache invalidation across multiple server instances serving the same files.
**Action:** Use directory-level watching and shared watcher pools for high-density file serving applications.
