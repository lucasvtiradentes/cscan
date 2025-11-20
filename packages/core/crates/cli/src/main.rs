use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

mod commands;
mod config_loader;

use commands::{cmd_check, cmd_init, cmd_rules};
use core::{init_logger, APP_DESCRIPTION, APP_NAME};

#[derive(Parser)]
#[command(name = APP_NAME)]
#[command(version, about = APP_DESCRIPTION, long_about = None)]
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
    init_logger();

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
