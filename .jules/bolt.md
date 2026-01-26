## 2024-05-20 - Inefficient File Watching
**Learning:** The application was creating a new `chokidar` file watcher for every single file served via `serveFile`. When serving a directory, this resulted in a large number of redundant watchers, consuming unnecessary system resources and increasing startup time.
**Action:** Refactor the `serveDirectory` function to use a single `chokidar` watcher for the entire directory. This watcher will manage cache invalidation for all files within that directory, significantly reducing the number of active watchers.
