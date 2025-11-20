use base64::Engine;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::{self, BufRead, Write};
use tracing::{error, info};

mod handlers;
mod protocol;
mod state;

use handlers::*;
use protocol::*;
use state::ServerState;

fn main() {
    use time::macros::format_description;
    use time::UtcOffset;
    use tracing_subscriber::fmt::time::OffsetTime;
    use tracing_subscriber::fmt::Layer;
    use tracing_subscriber::layer::SubscriberExt;
    use tracing_subscriber::util::SubscriberInitExt;

    core::init_logger();

    let offset = UtcOffset::from_hms(-3, 0, 0).unwrap();
    let format = format_description!("[year]-[month]-[day]T[hour]:[minute]:[second].[subsecond digits:3][offset_hour sign:mandatory]:[offset_minute]");
    let timer = OffsetTime::new(offset, format);

    tracing_subscriber::registry()
        .with(
            Layer::new()
                .with_writer(io::stderr)
                .with_ansi(false)
                .with_target(false)
                .with_level(true)
                .with_timer(timer),
        )
        .with(tracing_subscriber::filter::LevelFilter::WARN)
        .init();

    info!("Tscanner server started");

    let mut state = ServerState::new();
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                error!("Failed to read line: {}", e);
                continue;
            }
        };

        if line.trim().is_empty() {
            continue;
        }

        let request: Request = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                error!("Failed to parse request: {}", e);
                continue;
            }
        };

        let response = handle_request(request, &mut state);
        send_response(&mut stdout, response);

        process_file_events(&state, &mut stdout);
    }
}

fn handle_request(request: Request, state: &mut ServerState) -> Response {
    match request.method.as_str() {
        "scan" => match serde_json::from_value(request.params) {
            Ok(params) => handle_scan(request.id, params, state),
            Err(e) => Response {
                id: request.id,
                result: None,
                error: Some(format!("Invalid params: {}", e)),
            },
        },
        "watch" => match serde_json::from_value(request.params) {
            Ok(params) => handle_watch(request.id, params, state),
            Err(e) => Response {
                id: request.id,
                result: None,
                error: Some(format!("Invalid params: {}", e)),
            },
        },
        "scanFile" => match serde_json::from_value(request.params) {
            Ok(params) => handle_scan_file(request.id, params, state),
            Err(e) => Response {
                id: request.id,
                result: None,
                error: Some(format!("Invalid params: {}", e)),
            },
        },
        "getRulesMetadata" => handle_get_rules_metadata(request.id),
        "scanContent" => match serde_json::from_value(request.params) {
            Ok(params) => handle_scan_content(request.id, params, state),
            Err(e) => Response {
                id: request.id,
                result: None,
                error: Some(format!("Invalid params: {}", e)),
            },
        },
        "clearCache" => handle_clear_cache(request.id, state),
        _ => Response {
            id: request.id,
            result: None,
            error: Some(format!("Unknown method: {}", request.method)),
        },
    }
}

fn send_response(stdout: &mut io::Stdout, response: Response) {
    let serialize_start = std::time::Instant::now();
    if let Ok(json) = serde_json::to_string(&response) {
        let serialize_time = serialize_start.elapsed();
        let original_size = json.len();

        let compress_start = std::time::Instant::now();
        let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
        if let Err(e) = encoder.write_all(json.as_bytes()) {
            error!("Failed to compress: {}", e);
        } else if let Ok(compressed) = encoder.finish() {
            let compress_time = compress_start.elapsed();
            let compressed_size = compressed.len();

            if serialize_time.as_millis() > 50 || compress_time.as_millis() > 50 {
                info!(
                    "Serialization took {}ms ({}KB), compression took {}ms ({}KB → {}KB, {:.1}%)",
                    serialize_time.as_millis(),
                    original_size / 1024,
                    compress_time.as_millis(),
                    original_size / 1024,
                    compressed_size / 1024,
                    (compressed_size as f64 / original_size as f64) * 100.0
                );
            }

            let write_start = std::time::Instant::now();
            if let Err(e) = stdout.write_all(b"GZIP:") {
                error!("Failed to write marker: {}", e);
            } else {
                let encoded = base64::engine::general_purpose::STANDARD.encode(&compressed);
                if let Err(e) = stdout.write_all(encoded.as_bytes()) {
                    error!("Failed to write compressed data: {}", e);
                }
                if let Err(e) = stdout.write_all(b"\n") {
                    error!("Failed to write newline: {}", e);
                }
            }
            let write_time = write_start.elapsed();

            let flush_start = std::time::Instant::now();
            if let Err(e) = stdout.flush() {
                error!("Failed to flush stdout: {}", e);
            }
            let flush_time = flush_start.elapsed();

            if write_time.as_millis() > 50 || flush_time.as_millis() > 50 {
                info!(
                    "Write took {}ms, flush took {}ms",
                    write_time.as_millis(),
                    flush_time.as_millis()
                );
            }
        }
    }
}

fn process_file_events(state: &ServerState, stdout: &mut io::Stdout) {
    if let Some(watcher) = &state.watcher {
        while let Some(event) = watcher.try_recv() {
            info!("File event: {:?}", event);

            use core::watcher::FileEvent;
            match event {
                FileEvent::Modified(path) | FileEvent::Created(path) => {
                    if let Some(scanner) = &state.scanner {
                        if let Some(result) = scanner.scan_single(&path) {
                            let notification = Notification {
                                method: "file_updated".to_string(),
                                params: serde_json::to_value(&result).unwrap(),
                            };
                            if let Ok(json) = serde_json::to_string(&notification) {
                                let _ = writeln!(stdout, "{}", json);
                                let _ = stdout.flush();
                            }
                        }
                    }
                }
                FileEvent::Removed(path) => {
                    state.cache.invalidate(&path);
                }
            }
        }
    }
}
