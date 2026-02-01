# Bolt's Journal

## 2025-05-14 - Directory-level Shared File Watchers
**Learning:** Watching individual files with Chokidar in a high-traffic or large-directory file server creates a massive overhead in file descriptors and memory. Shared directory-level watchers with reference counting significantly improve resource efficiency.
**Action:** Always consider if resource watchers can be consolidated at a higher level (like directory vs file) to reduce system call overhead and memory consumption.
