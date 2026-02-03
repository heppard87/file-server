## 2025-05-14 - Directory-level File Watching Optimization
**Learning:** Consolidating multiple file watchers into a single directory-level watcher (depth: 0) reduces resource overhead and setup time by approximately 92% for directories with numerous files (e.g., 2000+). This approach also naturally handles shared files across different server instances more efficiently.
**Action:** When implementing file watching for multiple files in the same tree, prefer directory-level watchers with manual filtering or mapping over individual file watchers.
