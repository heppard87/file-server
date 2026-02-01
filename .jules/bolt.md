## 2025-05-14 - Consolidating file watchers to directory-level
**Learning:** Watching individual files with `chokidar` is significantly more expensive than watching their parent directory with `depth: 0`. For 500 files, it reduces setup time by ~43% and avoids hitting OS limits on file descriptors.
**Action:** Always consider directory-level watching when dealing with many files in the same directory structure.

## 2025-05-14 - Absolute path resolution for cache keys
**Learning:** Using `path.resolve` for cache keys and watcher tracking ensures consistency across different relative path representations of the same file. This prevents duplicate caching and redundant watchers.
**Action:** Use normalized absolute paths for internal resource management (cache, watchers) but preserve original user paths for error messages and logs.
