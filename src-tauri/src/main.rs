// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::prelude::{DateTime, Utc};
use std::fs;
use std::process::Command;
use tauri::{CustomMenuItem, Menu, Submenu};

// create the error type that represents all errors possible in our program
#[derive(Debug, thiserror::Error)]
enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

// we must manually implement serde::Serialize
impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(serde::Serialize)]
struct DirEntity {
    name: String,
    path: String,
    file_type: String,
    mime_type: mimty::MimeType,
    file_size: u64,
    created_at: String,
    edited_at: String,
    accessed_at: String,
}

impl DirEntity {
    fn new(entry: fs::DirEntry) -> Result<DirEntity, Error> {
        let path = entry.path();
        let name = entry.file_name().into_string().unwrap();
        let metadata = entry.metadata()?;
        let mime_type = mimty::file(name.clone());
        if path.is_dir() {
            Ok(DirEntity {
                name,
                path: path.display().to_string(),
                file_type: String::from("directory"),
                mime_type,
                file_size: 0,
                created_at: iso8601(&metadata.created()?),
                edited_at: iso8601(&metadata.modified()?),
                accessed_at: iso8601(&metadata.accessed()?),
            })
        } else {
            Ok(DirEntity {
                name,
                path: path.display().to_string(),
                file_type: String::from("file"),
                mime_type,
                file_size: metadata.len(),
                created_at: iso8601(&metadata.created()?),
                edited_at: iso8601(&metadata.modified()?),
                accessed_at: iso8601(&metadata.accessed()?),
            })
        }
    }
}

#[derive(serde::Serialize)]
struct FilesResult {
    directories: Vec<DirEntity>,
    files: Vec<DirEntity>,
}

#[tauri::command]
fn get_files(path: String) -> Result<FilesResult, Error> {
    let mut directories = Vec::new();
    let mut files = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().into_string().unwrap();
        if let Some(c) = name.chars().next() {
            if c != '.' {
                if path.is_dir() {
                    directories.push(DirEntity::new(entry)?);
                } else {
                    files.push(DirEntity::new(entry)?);
                }
            }
        }
    }
    Ok(FilesResult { directories, files })
}

#[tauri::command]
fn open_terminal(path: String) {
    println!("{}", path);
    let mut path_array: Vec<_> = path.split("/").collect();
    path_array.pop();
    let dir_path = path_array.join("/");
    Command::new("kitty")
        .args(["--hold", "nvim", &path])
        .current_dir(std::path::Path::new(&dir_path))
        .spawn()
        .unwrap();
}

use rust_search::{similarity_sort, SearchBuilder};
#[tauri::command]
fn search_dir(path: String, query: String) -> Result<FilesResult, Error> {
    let mut search: Vec<String> = SearchBuilder::default()
        .location(path)
        .search_input(&query)
        .depth(10)
        .ignore_case()
        .limit(100)
        .build()
        .collect();

    similarity_sort(&mut search, &query);
    let mut directories = Vec::new();
    let mut files = Vec::new();
    for path in search {
        let metadata = fs::metadata(path.clone()).unwrap();
        let mut path_array: Vec<_> = path.split("/").collect();
        let name = path_array.pop().unwrap().to_string();
        let mime_type = mimty::file(name.clone());
        if metadata.is_dir() {
            directories.push(DirEntity {
                name,
                path,
                file_type: String::from("directory"),
                mime_type,
                file_size: 0,
                created_at: iso8601(&metadata.created()?),
                edited_at: iso8601(&metadata.modified()?),
                accessed_at: iso8601(&metadata.accessed()?),
            })
        } else {
            files.push(DirEntity {
                name,
                path,
                file_type: String::from("file"),
                mime_type,
                file_size: metadata.len(),
                created_at: iso8601(&metadata.created()?),
                edited_at: iso8601(&metadata.modified()?),
                accessed_at: iso8601(&metadata.accessed()?),
            })
        }
    }
    Ok(FilesResult { directories, files })
}

#[tauri::command]
fn move_file(source: String, dest: String) {
    let _ = Command::new("mv").args([source.to_string(), dest.to_string()]).output();
}

#[tauri::command]
fn create_file(name: String, path: String) {
    let _ = Command::new("touch").current_dir(path).args([name]).output();
}

#[tauri::command]
fn create_folder(name: String, path: String) {
    let _ = Command::new("mkdir").current_dir(path).args([name]).output();
}

fn delete_file(path: String) {
    let _ = Command::new("rm").args([path]).output();
}

fn delete_folder (path: String) {
    let _ = Command::new("rm").args([ "-rf", &path ]).output();
}

#[tauri::command]
fn delete_entity(path: String, is_dir: bool) {
    if is_dir {
        delete_folder(path);
    } else {
        delete_file(path);
    }
}

fn iso8601(st: &std::time::SystemTime) -> String {
    let dt: DateTime<Utc> = st.clone().into();
    format!("{}", dt.format("%+"))
    // formats like "2001-07-08T00:34:60.026490+09:30"
}

fn main() {
    let submenu_file = Submenu::new(
        "File",
        Menu::new()
            .add_item(CustomMenuItem::new("create_file", "New File"))
            .add_item(CustomMenuItem::new("create_folder", "New Folder"))
            .add_item(CustomMenuItem::new("delete", "Delete"))
            .add_item(CustomMenuItem::new("preferences", "Preferences")),
    );
    let submenu_open = Submenu::new(
        "Open",
        Menu::new().add_item(CustomMenuItem::new("open_with", "Open With")),
    );
    let menu = Menu::new()
        .add_submenu(submenu_file)
        .add_submenu(submenu_open);

    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(|event| match event.menu_item_id() {
            _ => {
                let _ = event.window().emit("menu", event.menu_item_id());
                println!("{}", event.menu_item_id())
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_files,
            open_terminal,
            search_dir,
            move_file,
            create_file,
            create_folder,
            delete_entity
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
