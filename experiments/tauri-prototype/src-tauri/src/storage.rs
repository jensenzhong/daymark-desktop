//! Isolated prototype storage. Never points to the Electron application's data.
use serde::{Deserialize, Serialize};
use std::{fs::{self, OpenOptions}, io::{self, Write}, path::{Path, PathBuf}};

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
}

/// Snapshots are committed by linking a fully flushed temporary file to a new
/// filename. A malformed newest snapshot is an error, never an empty task list.
pub struct Storage { directory: PathBuf, generation: u64 }

impl Storage {
    pub fn open(directory: impl AsRef<Path>) -> io::Result<(Self, Data)> {
        let directory = directory.as_ref().to_path_buf();
        fs::create_dir_all(&directory)?;
        let mut newest = None;
        for entry in fs::read_dir(&directory)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if let Some(number) = name.strip_prefix("tasks-").and_then(|s| s.strip_suffix(".json")).and_then(|s| s.parse::<u64>().ok()) {
                if newest.as_ref().map_or(true, |(old, _)| number > *old) { newest = Some((number, entry.path())); }
            }
        }
        let (generation, data) = match newest {
            Some((number, path)) => {
                let bytes = fs::read(path)?;
                let data = serde_json::from_slice(&bytes).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
                (number, data)
            }
            None => (0, Data::default()),
        };
        Ok((Self { directory, generation }, data))
    }

    pub fn save(&mut self, data: &Data) -> io::Result<()> {
        let next = self.generation.checked_add(1).ok_or_else(|| io::Error::other("snapshot generation exhausted"))?;
        let final_path = self.directory.join(format!("tasks-{next:020}.json"));
        let temporary = self.directory.join(format!("tasks-{next:020}.{}.tmp", std::process::id()));
        let result = (|| {
            let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)?;
            serde_json::to_writer(&mut file, data).map_err(io::Error::other)?;
            file.flush()?;
            file.sync_all()?;
            // Unlike rename on Windows, a hard link cannot replace another
            // process's committed snapshot if two instances race.
            fs::hard_link(&temporary, &final_path)?;
            let _ = fs::remove_file(&temporary);
            Ok(())
        })();
        if result.is_err() { let _ = fs::remove_file(&temporary); }
        result?;
        self.generation = next;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    fn directory() -> PathBuf {
        std::env::temp_dir().join(format!("daymark-prototype-storage-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()))
    }
    #[test]
    fn snapshots_survive_restart_and_keep_prior_copy() {
        let path = directory();
        let (mut storage, mut data) = Storage::open(&path).unwrap();
        data.todos.push(Todo { id: "one".into(), text: "Task".into(), done: false, date: "2026-11-12".into(), created_at: 1, order: 0, reminder_at: Some(100) });
        storage.save(&data).unwrap();
        data.todos[0].text = "Updated".into();
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
        assert!(matches!(Storage::open(&path), Err(error) if error.kind() == io::ErrorKind::InvalidData));
        assert_eq!(fs::read(path.join("tasks-00000000000000000002.json")).unwrap(), b"broken");
        fs::remove_dir_all(path).unwrap();
    }
}
