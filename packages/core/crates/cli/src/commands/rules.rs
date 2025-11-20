use anyhow::{Context, Result};
use colored::*;
use core::types::Severity;
use std::fs;
use std::path::Path;

use crate::config_loader::load_config_with_path;
use core::{APP_DISPLAY_NAME, APP_NAME};

pub fn cmd_rules(path: &Path) -> Result<()> {
    let root = fs::canonicalize(path).context("Failed to resolve path")?;

    let (config, config_path) = match load_config_with_path(&root)? {
        Some((cfg, path)) => (cfg, path),
        None => {
            eprintln!(
                "{}",
                format!("Error: No {} configuration found!", APP_NAME)
                    .red()
                    .bold()
            );
            eprintln!();
            eprintln!(
                "Run {} to create a default configuration.",
                format!("{} init", APP_NAME).cyan()
            );
            std::process::exit(1);
        }
    };

    println!(
        "{}",
        format!("{} Rules Configuration", APP_DISPLAY_NAME)
            .cyan()
            .bold()
    );
    println!("Config: {}\n", config_path.dimmed());

    let mut enabled_rules: Vec<_> = config.rules.iter().filter(|(_, cfg)| cfg.enabled).collect();
    enabled_rules.sort_by_key(|(name, _)| *name);

    if enabled_rules.is_empty() {
        println!("{}", "No rules enabled.".yellow());
        return Ok(());
    }

    println!("{} enabled rules:\n", enabled_rules.len());

    for (name, rule_config) in enabled_rules {
        let severity_badge = match rule_config.severity {
            Severity::Error => "ERROR".red(),
            Severity::Warning => "WARN".yellow(),
        };

        let rule_type = match rule_config.rule_type {
            core::config::RuleType::Ast => "AST".cyan(),
            core::config::RuleType::Regex => "REGEX".magenta(),
        };

        print!("  {} ", "•".cyan());
        print!("{} ", name.bold());
        print!("[{}] ", rule_type);
        println!("{}", severity_badge);

        if let Some(msg) = &rule_config.message {
            println!("    {}", msg.dimmed());
        }

        if let Some(pattern) = &rule_config.pattern {
            println!("    Pattern: {}", pattern.yellow());
        }
    }

    let disabled_count = config.rules.iter().filter(|(_, cfg)| !cfg.enabled).count();
    if disabled_count > 0 {
        println!("\n{} disabled rules", disabled_count.to_string().dimmed());
    }

    Ok(())
}
