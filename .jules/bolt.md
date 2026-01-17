## 2024-07-16 - Chokidar Watcher Proliferation

**Learning:** A major performance anti-pattern was discovered where the `serveFile` function created a new `chokidar` file watcher for every individual file it served. When serving a directory with many files, this leads to excessive memory consumption and a high number of open file descriptors, severely degrading performance.

**Action:** When implementing file-watching functionality, always check if a directory-level watcher can be used instead of individual file watchers. For this codebase, the pattern is to create a single watcher per directory in `serveDirectory` and suppress individual watcher creation in `serveFile` when it's called from `serveDirectory`.