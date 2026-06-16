# Lessons Learned

- Real-time audio in Rust requires strict lock-free queues to avoid micro-stutters.
- Tauri IPC channel streaming is highly effective for event-driven UI updates.
- Avoiding React/Vue requires disciplined state management and manual DOM cleanup on route changes.
