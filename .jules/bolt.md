# Bolt's Journal ⚡

## 2026-02-02 - [Watcher Consolidation]
**Learning:** Consolidating individual file watchers into directory-level watchers (depth: 0) significantly reduces file descriptor pressure and setup time (by ~45%) in applications serving many files. However, it requires careful reference counting to manage the lifecycle of shared watchers across multiple server instances.
**Action:** Use a global shared watcher registry with a `Set` of interested instances and use `path.resolve` to ensure path consistency across different ways of referencing the same file.
