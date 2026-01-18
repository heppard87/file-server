## 2024-05-20 - Chokidar Watcher Anti-Pattern

**Learning:** Creating a new `chokidar` file watcher for every file served is a significant performance anti-pattern. This leads to excessive resource consumption (memory and CPU) as the number of files grows.

**Action:** Refactor the file watching logic to use a single watcher per directory. This will reduce the number of watchers to a minimum, improving scalability and performance.
