//! Campaign folders: Markdown notes plus a `campaign.json`, read and written
//! with paths relative to the campaign folder so nothing outside it is touched.

use std::fs;
use std::path::{Component, Path, PathBuf};

pub struct CampaignFile {
    pub path: String,
    pub content: String,
}

/// Biggest note read; anything larger is not a note someone typed.
const MAX_FILE: u64 = 4 * 1024 * 1024;

/// `root/rel`, refusing absolute paths, `..` and anything else that could leave the folder.
pub fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel.trim().is_empty() || rel_path.components().next().is_none() {
        return Err("Empty path".into());
    }
    for c in rel_path.components() {
        match c {
            Component::Normal(_) => {}
            _ => return Err(format!("Not a path inside the campaign: {}", rel)),
        }
    }
    Ok(root.join(rel_path))
}

fn collect(root: &Path, dir: &Path, out: &mut Vec<CampaignFile>) -> std::io::Result<()> {
    let mut entries: Vec<_> = fs::read_dir(dir)?.filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.path());
    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        // Hidden folders and files: .obsidian, .trash, .git…
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_dir() {
            collect(root, &path, out)?;
            continue;
        }
        let is_md = path
            .extension()
            .map(|e| e.eq_ignore_ascii_case("md"))
            .unwrap_or(false);
        let is_campaign = dir == root && name == "campaign.json";
        if !(is_md || is_campaign) || !kind.is_file() {
            continue;
        }
        if entry.metadata().map(|m| m.len() > MAX_FILE).unwrap_or(true) {
            continue;
        }
        // Skip unreadable or non-UTF-8 files instead of failing the whole campaign.
        if let Ok(content) = fs::read_to_string(&path) {
            let rel = path.strip_prefix(root).unwrap_or(&path);
            out.push(CampaignFile {
                path: rel.to_string_lossy().replace('\\', "/"),
                content,
            });
        }
    }
    Ok(())
}

/// Every note (`*.md`, outside hidden folders) and the `campaign.json` of a campaign folder.
pub fn read_campaign(root: &Path) -> Result<Vec<CampaignFile>, String> {
    if !root.is_dir() {
        return Err(format!("Folder not found: {}", root.display()));
    }
    let mut out = Vec::new();
    collect(root, root, &mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

/// Write a file, creating its folder. Goes through a temporary file so a crash never leaves half a note.
pub fn write_file(root: &Path, rel: &str, content: &str) -> Result<(), String> {
    let path = safe_join(root, rel)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_file_name(format!(
        ".{}.daybreak-tmp",
        path.file_name().map(|n| n.to_string_lossy()).unwrap_or_default()
    ));
    fs::write(&tmp, content).map_err(|e| format!("{}: {}", rel, e))?;
    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("{}: {}", rel, e)
    })
}

/// Rename or move a file inside the campaign. Never overwrites another file.
pub fn rename_file(root: &Path, from: &str, to: &str) -> Result<(), String> {
    let src = safe_join(root, from)?;
    let dst = safe_join(root, to)?;
    // A change of case only is the same file on Windows and macOS.
    let same_file = from.to_lowercase() == to.to_lowercase();
    if dst.exists() && !same_file {
        return Err(format!("{} already exists", to));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&src, &dst).map_err(|e| format!("{}: {}", from, e))
}

/// `dir/name`, or `dir/name 2`, `dir/name 3`… when taken (the extension stays last).
fn unused(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let p = Path::new(name);
    let stem = p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let ext = p.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    (2..)
        .map(|i| dir.join(format!("{} {}{}", stem, i, ext)))
        .find(|c| !c.exists())
        .expect("some name is free")
}

/// Move a note to the campaign's `.trash` folder (the one Obsidian uses), so a deleted note can be recovered.
pub fn trash_file(root: &Path, rel: &str) -> Result<(), String> {
    let src = safe_join(root, rel)?;
    let trash = root.join(".trash");
    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or("Not a file")?;
    fs::rename(&src, unused(&trash, &name)).map_err(|e| format!("{}: {}", rel, e))
}

/// A folder name that works on every system.
pub fn folder_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') && !c.is_control())
        .collect();
    let t = cleaned.trim().trim_start_matches('.').trim_end_matches(['.', ' ']).trim();
    if t.is_empty() {
        "Campaign".into()
    } else {
        t.chars().take(100).collect()
    }
}

/// Create a new, empty campaign folder in `base`.
pub fn new_campaign_dir(base: &Path, name: &str) -> Result<PathBuf, String> {
    fs::create_dir_all(base).map_err(|e| e.to_string())?;
    let dir = unused(base, &folder_name(name));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("daybreak-campaign-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn refuses_paths_outside_the_folder() {
        let root = Path::new("/c");
        assert!(safe_join(root, "Notes/Mira.md").is_ok());
        assert!(safe_join(root, "../x.md").is_err());
        assert!(safe_join(root, "Notes/../../x.md").is_err());
        assert!(safe_join(root, "/etc/passwd").is_err());
        assert!(safe_join(root, "").is_err());
    }

    #[test]
    fn writes_reads_renames_and_trashes() {
        let root = temp("rw");
        write_file(&root, "Notes/Mira.md", "# Mira").unwrap();
        write_file(&root, "campaign.json", "{}").unwrap();
        write_file(&root, ".obsidian/app.json", "{}").unwrap();
        write_file(&root, "Notes/image.png", "x").unwrap();
        let mut files: Vec<_> = read_campaign(&root).unwrap().into_iter().map(|f| (f.path, f.content)).collect();
        files.sort();
        assert_eq!(files, vec![("Notes/Mira.md".into(), "# Mira".into()), ("campaign.json".into(), "{}".into())]);

        write_file(&root, "Notes/Tor.md", "t").unwrap();
        assert!(rename_file(&root, "Notes/Mira.md", "Notes/Tor.md").is_err());
        rename_file(&root, "Notes/Mira.md", "Quests/Mira Brightforge.md").unwrap();
        assert!(root.join("Quests/Mira Brightforge.md").is_file());

        trash_file(&root, "Notes/Tor.md").unwrap();
        write_file(&root, "Notes/Tor.md", "t2").unwrap();
        trash_file(&root, "Notes/Tor.md").unwrap();
        assert!(root.join(".trash/Tor.md").is_file());
        assert_eq!(fs::read_to_string(root.join(".trash/Tor 2.md")).unwrap(), "t2");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn makes_unique_campaign_folders() {
        let base = temp("new");
        let a = new_campaign_dir(&base, "Curse: of the Lich?").unwrap();
        let b = new_campaign_dir(&base, "Curse: of the Lich?").unwrap();
        assert_eq!(a.file_name().unwrap(), "Curse of the Lich");
        assert_eq!(b.file_name().unwrap(), "Curse of the Lich 2");
        assert_eq!(folder_name(" ..."), "Campaign");
        let _ = fs::remove_dir_all(&base);
    }
}
