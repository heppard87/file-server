## YYYY-MM-DD - Inefficient file watching strategy
**Learning:** Creating a new `chokidar` file watcher for every file is a performance anti-pattern.
**Action:** Use a single watcher per directory and handle events for individual files.