## 2025-05-15 - Directory-level Shared File Watching

**Learning:** Consolidating individual file watchers into a single directory-level watcher (depth: 0) reduces setup time by ~92% and saves significant system resources (file descriptors, memory). Using `path.resolve` is critical for consistent cache keys and shared watcher paths.

**Action:** Always prefer directory-level watching for static file servers. Use absolute paths for all internal tracking and cache keys to avoid duplication. Ensure shared state (like watchers) is correctly reference-counted for lifecycle management.
