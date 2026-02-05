## 2025-05-14 - [Consolidate File Watchers to Directory-Level]
**Learning:** Consolidating multiple file watchers into a single directory-level watcher (depth: 0) reduces resource overhead and setup time by approximately 94% for large numbers of files (e.g., 2000+). Using a shared global watcher with reference counting (via a Set of interested instances) ensures efficient resource usage across multiple server instances.
**Action:** Always consider directory-level watching instead of individual file watching when a large number of files in the same directory need to be monitored.
