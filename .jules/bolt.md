## 2024-08-07 - Inefficient File Watcher Creation

**Learning:** The `serveDirectory` function was creating a new `chokidar` file watcher for every file it served, leading to a classic "N+1" problem where N is the number of files. This is a significant performance anti-pattern as it consumes excessive memory and can hit OS-level limits on file handles.

**Action:** When serving directories, create a single watcher for the entire directory instead of one for each file. Use a private flag (e.g., `_suppressWatcher`) to prevent the file-serving function from creating its own watcher when called from the directory-serving function. This pattern should be applied in any situation where multiple resources within a single container (like a directory) are being monitored.
