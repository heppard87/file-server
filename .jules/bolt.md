## 2024-05-20 - Inefficient File Watcher Creation

**Learning:** Creating a new `chokidar` file watcher for every file served is a significant performance anti-pattern. This leads to excessive resource consumption, especially when serving directories with many files.

**Action:** When serving directories, use a single watcher per directory and use its events to invalidate the cache for individual files. This will drastically reduce the number of watchers and improve performance.
