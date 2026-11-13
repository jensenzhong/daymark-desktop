//! Isolated prototype storage. Never points to the Electron application's data.
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    pub text: String,
    pub done: bool,
    pub date: String,
    pub created_at: u64,
    pub order: i64,
    pub reminder_at: Option<i64>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Data {
    pub todos: Vec<Todo>,
    #[serde(default)]
    pub settings: serde_json::Value,
}

impl Data {
    pub fn append_batch(&mut self, todos: Vec<Todo>) -> Result<(), &'static str> {
        let mut updated = self.clone();
        for todo in todos {
            updated.append(todo)?;
        }
        *self = updated;
        Ok(())
    }
    pub fn append(&mut self, mut todo: Todo) -> Result<(), &'static str> {
        todo.text = todo.text.trim().to_owned();
        let date = todo.date.as_str();
        if todo.id.is_empty()
            || todo.text.is_empty()
            || date.len() != 10
            || !date.bytes().enumerate().all(|(i, b)| {
                if i == 4 || i == 7 {
                    b == b'-'
                } else {
                    b.is_ascii_digit()
                }
            })
        {
            return Err("Invalid task text, ID or date");
        }
        if self.todos.iter().any(|item| item.id == todo.id) {
            return Err("Task ID already exists");
        }
        todo.order = self
            .todos
            .iter()
            .filter(|item| item.date == todo.date)
            .map(|item| item.order)
            .max()
            .unwrap_or(-1)
            .saturating_add(1);
        self.todos.push(todo);
        Ok(())
    }
    pub fn next_due(&self, now: i64) -> Option<Todo> {
        self.todos
            .iter()
            .filter(|todo| !todo.done && todo.reminder_at.is_some_and(|at| at <= now))
            .min_by_key(|todo| todo.reminder_at)
            .cloned()
    }

    /// Only clear the exact reminder that was shown; preserve a newly edited time.
    pub fn acknowledge(&mut self, shown: &Todo) -> bool {
        if let Some(todo) = self.todos.iter_mut().find(|todo| todo.id == shown.id) {
            if todo.reminder_at == shown.reminder_at && todo.reminder_at.is_some() {
                todo.reminder_at = None;
                return true;
            }
        }
        false
    }
    pub fn reorder(&mut self, ids: &[String]) -> Result<(), &'static str> {
        let mut seen = std::collections::HashSet::new();
        let mut date: Option<&str> = None;
        for id in ids {
            if !seen.insert(id) {
                return Err("Duplicate task ID");
            }
            let todo = self
                .todos
                .iter()
                .find(|todo| &todo.id == id)
                .ok_or("Task not found")?;
            if date.is_some_and(|previous| previous != todo.date.as_str()) {
                return Err("Tasks must have the same date");
            }
            date = Some(&todo.date);
        }
        for (order, id) in ids.iter().enumerate() {
            self.todos
                .iter_mut()
                .find(|todo| &todo.id == id)
                .unwrap()
                .order = order as i64;
        }
        Ok(())
    }
    /// Move unfinished tasks from previous dates to today, preserving their order.
    pub fn rollover(&mut self, today: &str) -> bool {
        let mut overdue: Vec<usize> = self
            .todos
            .iter()
            .enumerate()
            .filter(|(_, todo)| !todo.done && todo.date.as_str() < today)
            .map(|(index, _)| index)
            .collect();
        overdue.sort_by(|&a, &b| {
            self.todos[a]
                .date
                .cmp(&self.todos[b].date)
                .then_with(|| self.todos[a].order.cmp(&self.todos[b].order))
                .then_with(|| a.cmp(&b))
        });
        let mut order = self
            .todos
            .iter()
            .filter(|todo| todo.date == today)
            .map(|todo| todo.order)
            .max()
            .unwrap_or(-1)
            .saturating_add(1);
        for index in overdue.iter().copied() {
            let todo = &mut self.todos[index];
            todo.date = today.to_owned();
            todo.order = order;
            order = order.saturating_add(1);
        }
        !overdue.is_empty()
    }
}

/// Snapshots are committed by linking a fully flushed temporary file to a new
/// filename. A malformed newest snapshot is an error, never an empty task list.
pub struct Storage {
    directory: PathBuf,
    generation: u64,
}

impl Storage {
    pub fn open(directory: impl AsRef<Path>) -> io::Result<(Self, Data)> {
        let directory = directory.as_ref().to_path_buf();
        fs::create_dir_all(&directory)?;
        let mut newest = None;
        for entry in fs::read_dir(&directory)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if let Some(number) = name
                .strip_prefix("tasks-")
                .and_then(|s| s.strip_suffix(".json"))
                .and_then(|s| s.parse::<u64>().ok())
            {
                if newest.as_ref().map_or(true, |(old, _)| number > *old) {
                    newest = Some((number, entry.path()));
                }
            }
        }
        let (generation, data) = match newest {
            Some((number, path)) => {
                let bytes = fs::read(path)?;
                let data = serde_json::from_slice(&bytes)
                    .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                (number, data)
            }
            None => (0, Data::default()),
        };
        Ok((
            Self {
                directory,
                generation,
            },
            data,
        ))
    }

    pub fn save(&mut self, data: &Data) -> io::Result<()> {
        let next = self
            .generation
            .checked_add(1)
            .ok_or_else(|| io::Error::other("snapshot generation exhausted"))?;
        let final_path = self.directory.join(format!("tasks-{next:020}.json"));
        let temporary = self
            .directory
            .join(format!("tasks-{next:020}.{}.tmp", std::process::id()));
        let result: io::Result<()> = (|| {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            serde_json::to_writer(&mut file, data).map_err(io::Error::other)?;
            file.flush()?;
            file.sync_all()?;
            // Unlike rename on Windows, a hard link cannot replace another
            // process's committed snapshot if two instances race.
            fs::hard_link(&temporary, &final_path)?;
            let _ = fs::remove_file(&temporary);
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        result?;
        self.generation = next;
        // Keep several recovery points without growing forever. Only files
        // created by this store are considered; cleanup cannot invalidate the
        // newly committed snapshot and failure leaves extra backups intact.
        if let Ok(entries) = fs::read_dir(&self.directory) {
            let mut snapshots: Vec<_> = entries
                .filter_map(Result::ok)
                .filter_map(|entry| {
                    let name = entry.file_name();
                    let name = name.to_string_lossy();
                    let number = name.strip_prefix("tasks-")?.strip_suffix(".json")?;
                    if number.len() != 20 || !number.bytes().all(|b| b.is_ascii_digit()) {
                        return None;
                    }
                    Some((number.parse::<u64>().ok()?, entry.path()))
                })
                .collect();
            snapshots.sort_by_key(|(generation, _)| std::cmp::Reverse(*generation));
            for (_, path) in snapshots.into_iter().skip(10) {
                let _ = fs::remove_file(path);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    fn directory() -> PathBuf {
        std::env::temp_dir().join(format!(
            "daymark-prototype-storage-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }
    #[test]
    fn snapshots_survive_restart_and_keep_prior_copy() {
        let path = directory();
        let (mut storage, mut data) = Storage::open(&path).unwrap();
        data.todos.push(Todo {
            id: "one".into(),
            text: "Task".into(),
            done: false,
            date: "2026-11-12".into(),
            created_at: 1,
            order: 0,
            reminder_at: Some(100),
        });
        storage.save(&data).unwrap();
        data.todos[0].text = "Updated".into();
        data.settings = serde_json::json!({"language": "zh", "alwaysOnTop": true});
        storage.save(&data).unwrap();
        let (_, reopened) = Storage::open(&path).unwrap();
        assert_eq!(reopened, data);
        assert_eq!(fs::read_dir(&path).unwrap().count(), 2);
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn corrupt_latest_snapshot_is_not_silently_replaced() {
        let path = directory();
        let (mut storage, data) = Storage::open(&path).unwrap();
        storage.save(&data).unwrap();
        fs::write(path.join("tasks-00000000000000000002.json"), b"broken").unwrap();
        assert!(
            matches!(Storage::open(&path), Err(error) if error.kind() == io::ErrorKind::InvalidData)
        );
        assert_eq!(
            fs::read(path.join("tasks-00000000000000000002.json")).unwrap(),
            b"broken"
        );
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn stale_writer_cannot_replace_a_committed_snapshot() {
        let path = directory();
        let (mut first, data) = Storage::open(&path).unwrap();
        let (mut second, _) = Storage::open(&path).unwrap();
        first.save(&data).unwrap();
        assert_eq!(
            second.save(&data).unwrap_err().kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(Storage::open(&path).unwrap().1, data);
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn storage_limits_recovery_snapshots_after_successful_saves() {
        let path = directory();
        let (mut storage, data) = Storage::open(&path).unwrap();
        for _ in 0..12 {
            storage.save(&data).unwrap();
        }
        assert_eq!(fs::read_dir(&path).unwrap().count(), 10);
        assert_eq!(Storage::open(&path).unwrap().1, data);
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn snapshots_without_settings_remain_readable() {
        let path = directory();
        fs::create_dir_all(&path).unwrap();
        fs::write(
            path.join("tasks-00000000000000000001.json"),
            br#"{"todos":[]}"#,
        )
        .unwrap();
        let (_, data) = Storage::open(&path).unwrap();
        assert!(data.todos.is_empty());
        assert!(data.settings.is_null());
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn rollover_moves_only_unfinished_tasks_in_order() {
        let task = |id: &str, date: &str, order, done| Todo {
            id: id.into(),
            text: id.into(),
            done,
            date: date.into(),
            created_at: 1,
            order,
            reminder_at: Some(100),
        };
        let mut data = Data {
            todos: vec![
                task("late", "2026-11-11", 4, false),
                task("today", "2026-11-12", 0, false),
                task("early", "2026-11-10", 2, false),
                task("done", "2026-11-10", 0, true),
            ],
            ..Data::default()
        };
        assert!(data.rollover("2026-11-12"));
        assert_eq!((data.todos[2].order, data.todos[0].order), (1, 2));
        assert_eq!(data.todos[3].date, "2026-11-10");
        assert_eq!(data.todos[0].reminder_at, Some(100));
        assert!(!data.rollover("2026-11-12"));
    }
    #[test]
    fn reordering_validates_all_ids_before_changing_anything() {
        let task = |id: &str, order| Todo {
            id: id.into(),
            text: id.into(),
            done: false,
            date: "2026-11-12".into(),
            created_at: 1,
            order,
            reminder_at: None,
        };
        let mut data = Data {
            todos: vec![task("a", 0), task("b", 1)],
            ..Data::default()
        };
        assert!(data.reorder(&["b".into(), "missing".into()]).is_err());
        assert_eq!((data.todos[0].order, data.todos[1].order), (0, 1));
        data.reorder(&["b".into(), "a".into()]).unwrap();
        assert_eq!((data.todos[0].order, data.todos[1].order), (1, 0));
    }
    #[test]
    fn reminders_ignore_completed_and_keep_a_newly_edited_time() {
        let task = |id: &str, at, done| Todo {
            id: id.into(),
            text: id.into(),
            done,
            date: "2026-11-12".into(),
            created_at: 1,
            order: 0,
            reminder_at: Some(at),
        };
        let mut data = Data {
            todos: vec![
                task("completed", 1, true),
                task("later", 3, false),
                task("first", 2, false),
            ],
            ..Data::default()
        };
        let shown = data.next_due(3).unwrap();
        assert_eq!(shown.id, "first");
        data.todos[2].reminder_at = Some(10);
        assert!(!data.acknowledge(&shown));
        assert_eq!(data.todos[2].reminder_at, Some(10));
        let next = data.next_due(3).unwrap();
        assert!(data.acknowledge(&next));
        assert!(data.next_due(3).is_none());
    }
    #[test]
    fn append_uses_date_maximum_order_and_rejects_duplicate_ids() {
        let task = |id: &str, order| Todo {
            id: id.into(),
            text: " task ".into(),
            done: false,
            date: "2026-11-12".into(),
            created_at: 1,
            order,
            reminder_at: None,
        };
        let mut data = Data {
            todos: vec![task("old", 7)],
            ..Data::default()
        };
        data.append(task("new", 0)).unwrap();
        assert_eq!(data.todos[1].order, 8);
        assert_eq!(data.todos[1].text, "task");
        assert!(data.append(task("new", 0)).is_err());
        assert_eq!(data.todos.len(), 2);
    }
    #[test]
    fn batch_with_invalid_item_does_not_add_any_tasks() {
        let task = |id: &str| Todo {
            id: id.into(),
            text: "test".into(),
            done: false,
            date: "2026-11-12".into(),
            created_at: 1,
            order: 0,
            reminder_at: None,
        };
        let mut data = Data {
            todos: vec![task("old")],
            ..Data::default()
        };
        let before = data.clone();
        assert!(data.append_batch(vec![task("new"), task("old")]).is_err());
        assert_eq!(data, before);
    }
}
