use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use colored::*;
use cscan_core::cache::FileCache;
use cscan_core::config::CscanConfig;
use cscan_core::scanner::Scanner;
use cscan_core::types::Severity;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Parser)]
#[command(name = "cscan")]
#[command(version, about = "High-performance TypeScript/TSX code quality scanner", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Check {
        #[arg(value_name = "PATH", default_value = ".")]
        path: PathBuf,

        #[arg(long, help = "Skip cache and force full scan")]
        no_cache: bool,
    },

    Rules {
        #[arg(value_name = "PATH", default_value = ".")]
        path: PathBuf,
    },

    Init {
        #[arg(value_name = "PATH", default_value = ".")]
        path: PathBuf,
    },
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Check { path, no_cache } => cmd_check(&path, no_cache),
        Commands::Rules { path } => cmd_rules(&path),
        Commands::Init { path } => cmd_init(&path),
    }
}

fn cmd_check(path: &Path, no_cache: bool) -> Result<()> {
    let root = fs::canonicalize(path).context("Failed to resolve path")?;

    let config = match load_config(&root)? {
        Some(cfg) => cfg,
        None => {
            eprintln!("{}", "Error: No cscan configuration found!".red().bold());
            eprintln!();
            eprintln!("Searched for config in:");
            eprintln!(
                "  • {}",
                format!("{}/.cscan/rules.json", root.display()).yellow()
            );

            if let Some(global_path) = get_vscode_global_config_path(&root) {
                eprintln!("  • {}", global_path.display().to_string().yellow());
            }

            eprintln!();
            eprintln!(
                "Run {} to create a default configuration.",
                "cscan init".cyan()
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

fn cmd_rules(path: &Path) -> Result<()> {
    let root = fs::canonicalize(path).context("Failed to resolve path")?;

    let (config, config_path) = match load_config_with_path(&root)? {
        Some((cfg, path)) => (cfg, path),
        None => {
            eprintln!("{}", "Error: No cscan configuration found!".red().bold());
            eprintln!();
            eprintln!(
                "Run {} to create a default configuration.",
                "cscan init".cyan()
            );
            std::process::exit(1);
        }
    };

    println!("{}", "cscan Rules Configuration".cyan().bold());
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
            cscan_core::config::RuleType::Ast => "AST".cyan(),
            cscan_core::config::RuleType::Regex => "REGEX".magenta(),
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

fn cmd_init(path: &Path) -> Result<()> {
    let root = fs::canonicalize(path).context("Failed to resolve path")?;
    let config_dir = root.join(".cscan");
    let config_path = config_dir.join("rules.json");

    if config_path.exists() {
        eprintln!("{}", "Error: Configuration already exists!".red().bold());
        eprintln!("  {}", config_path.display());
        std::process::exit(1);
    }

    let default_config = CscanConfig::default();
    fs::create_dir_all(&config_dir).context("Failed to create .cscan directory")?;

    let config_json = serde_json::to_string_pretty(&default_config)?;
    fs::write(&config_path, config_json).context("Failed to write config file")?;

    println!("{}", "✓ Created default configuration".green().bold());
    println!("  {}", config_path.display());
    println!();
    println!("Edit this file to enable rules and customize settings.");

    Ok(())
}

fn load_config(root: &Path) -> Result<Option<CscanConfig>> {
    load_config_with_path(root).map(|opt| opt.map(|(cfg, _)| cfg))
}

fn load_config_with_path(root: &Path) -> Result<Option<(CscanConfig, String)>> {
    let local_path = root.join(".cscan").join("rules.json");
    if local_path.exists() {
        let config =
            CscanConfig::load_from_file(&local_path).map_err(|e| anyhow::anyhow!("{}", e))?;
        return Ok(Some((config, local_path.display().to_string())));
    }

    if let Some(global_path) = get_vscode_global_config_path(root) {
        if global_path.exists() {
            let config =
                CscanConfig::load_from_file(&global_path).map_err(|e| anyhow::anyhow!("{}", e))?;
            return Ok(Some((config, global_path.display().to_string())));
        }
    }

    Ok(None)
}

fn get_vscode_global_config_path(root: &Path) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let workspace_hash = compute_workspace_hash(root);

    Some(
        home.join(".config")
            .join("Code")
            .join("User")
            .join("globalStorage")
            .join("lucasvtiradentes.cscan-vscode-dev")
            .join("configs")
            .join(workspace_hash)
            .join("rules.json"),
    )
}

fn compute_workspace_hash(path: &Path) -> String {
    let path_str = path.to_string_lossy();
    let digest = md5::compute(path_str.as_bytes());
    format!("{:x}", digest)[..16].to_string()
}
