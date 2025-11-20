use anyhow::{Context, Result};
use colored::*;
use core::cache::FileCache;
use core::scanner::Scanner;
use core::types::Severity;
use std::fs;
use std::path::Path;
use std::sync::Arc;

use crate::config_loader::{get_vscode_global_config_path, load_config};
use core::{APP_NAME, CONFIG_DIR_NAME, CONFIG_FILE_NAME};

pub fn cmd_check(path: &Path, no_cache: bool) -> Result<()> {
    let root = fs::canonicalize(path).context("Failed to resolve path")?;

    let config = match load_config(&root)? {
        Some(cfg) => cfg,
        None => {
            eprintln!(
                "{}",
                format!("Error: No {} configuration found!", APP_NAME)
                    .red()
                    .bold()
            );
            eprintln!();
            eprintln!("Searched for config in:");
            eprintln!(
                "  • {}",
                format!(
                    "{}/{}/{}",
                    root.display(),
                    CONFIG_DIR_NAME,
                    CONFIG_FILE_NAME
                )
                .yellow()
            );

            if let Some(global_path) = get_vscode_global_config_path(&root) {
                eprintln!("  • {}", global_path.display().to_string().yellow());
            }

            eprintln!();
            eprintln!(
                "Run {} to create a default configuration.",
                format!("{} init", APP_NAME).cyan()
            );
            std::process::exit(1);
        }
    };

    let config_hash = config.compute_hash();
    let cache = if no_cache {
        FileCache::new()
    } else {
        FileCache::with_config_hash(config_hash)
    };

    let scanner =
        Scanner::with_cache(config, Arc::new(cache)).map_err(|e| anyhow::anyhow!("{}", e))?;

    println!("{}", "Scanning...".cyan().bold());
    let result = scanner.scan(&root);

    if result.files.is_empty() {
        println!("{}", "✓ No issues found!".green().bold());
        return Ok(());
    }

    let mut error_count = 0;
    let mut warning_count = 0;

    for file_result in &result.files {
        if file_result.issues.is_empty() {
            continue;
        }

        let relative_path = pathdiff::diff_paths(&file_result.file, &root)
            .unwrap_or_else(|| file_result.file.clone());

        println!("\n{}", relative_path.display().to_string().bold());

        for issue in &file_result.issues {
            match issue.severity {
                Severity::Error => error_count += 1,
                Severity::Warning => warning_count += 1,
            }

            let severity_icon = match issue.severity {
                Severity::Error => "✖".red(),
                Severity::Warning => "⚠".yellow(),
            };

            let location = format!("{}:{}", issue.line, issue.column).dimmed();
            let rule_name = format!("[{}]", issue.rule).cyan();

            println!(
                "  {} {} {} {}",
                severity_icon, location, issue.message, rule_name
            );

            if let Some(line_text) = &issue.line_text {
                let trimmed = line_text.trim();
                if !trimmed.is_empty() {
                    println!("    {}", trimmed.dimmed());
                }
            }
        }
    }

    println!();
    println!(
        "{} {} errors, {} warnings",
        if error_count > 0 {
            "✖".red()
        } else {
            "✓".green()
        },
        error_count.to_string().red(),
        warning_count.to_string().yellow()
    );
    println!(
        "Scanned {} files in {}ms",
        result.files.len(),
        result.duration_ms
    );

    if error_count > 0 {
        std::process::exit(1);
    }

    Ok(())
}
