## 2024-05-20 - Inefficient File Watching
**Learning:** Creating a new `chokidar` file watcher for every file served is a major performance anti-pattern. The correct approach is to use a single watcher per directory.
**Action:** When serving directories, create a single watcher and use its 'change' and 'unlink' events to manage the cache for individual files. Add a flag to `serveFile` to prevent it from creating redundant watchers when called from `serveDirectory`.
