## 2025-05-14 - [Shared Directory Watchers]
**Learning:** Watching individual files with `chokidar` is extremely resource-intensive in directories with many files. Switching to directory-level watching (depth 0) and sharing the watcher across multiple `FileServer` instances significantly reduces memory/FD usage and improves setup time by ~45%.
**Action:** Always consider directory-level watching for file servers or any application monitoring multiple files in the same location. Use a shared watcher system with reference counting for clean disposal.
