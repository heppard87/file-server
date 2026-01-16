## 2024-05-21 - Excessive File Watcher Creation

**Learning:** Creating a new `chokidar` file watcher for every file served, especially within a directory, is a significant performance anti-pattern. This leads to high memory consumption and CPU usage as the number of files grows.

**Action:** Refactor the code to use a single `chokidar` watcher per directory. The watcher's 'change' and 'unlink' events can then be used to invalidate the cache for specific files within that directory. This will drastically reduce the number of watchers and improve performance.
