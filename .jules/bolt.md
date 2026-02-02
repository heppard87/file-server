## 2026-02-02 - Consolidating file watchers to directory level
**Learning:** Creating a `chokidar` watcher for every single file being served is highly inefficient in terms of memory and file descriptors, especially when serving directories with many files. Consolidating watchers at the directory level (depth: 0) and sharing them across `FileServer` instances significantly reduces resource overhead.
**Action:** Use a global shared watcher map indexed by directory path, and implement reference counting to manage watcher lifecycle correctly across multiple `FileServer` instances.
