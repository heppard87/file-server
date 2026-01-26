## 2024-05-20 - Inefficient File Watcher Creation

**Learning:** The application was creating a new `chokidar` file watcher for every individual file being served. When serving a directory, this resulted in a large number of redundant watchers, consuming excessive memory and CPU resources, especially in directories with many files.

**Action:** Refactor the `serveDirectory` method to use a single `chokidar` watcher on the directory itself. This single watcher will handle cache invalidation for all files within that directory, significantly reducing resource overhead. The `serveFile` method will be updated to suppress creating a new watcher when called from `serveDirectory`.
