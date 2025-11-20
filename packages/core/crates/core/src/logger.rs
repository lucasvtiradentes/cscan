use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::constants::get_log_filename;

static LOGGER: Mutex<Option<Logger>> = Mutex::new(None);

pub struct Logger {
    file_path: PathBuf,
}

impl Logger {
    fn new() -> Self {
        let file_path = std::env::temp_dir().join(get_log_filename());
        Self { file_path }
    }

    fn write(&self, level: &str, message: &str) {
        use time::OffsetDateTime;

        let now = OffsetDateTime::now_utc();
        let utc_minus_3 = now.to_offset(time::UtcOffset::from_hms(-3, 0, 0).unwrap());

        let timestamp = utc_minus_3
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_else(|_| String::from("INVALID_TIMESTAMP"));

        let log_message = format!("[{}] [{}] {}\n", timestamp, level, message);

        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.file_path)
        {
            let _ = file.write_all(log_message.as_bytes());
        }
    }

    pub fn info(&self, message: &str) {
        self.write("INFO", message);
    }

    pub fn error(&self, message: &str) {
        self.write("ERROR", message);
    }

    pub fn warn(&self, message: &str) {
        self.write("WARN", message);
    }

    pub fn debug(&self, message: &str) {
        self.write("DEBUG", message);
    }
}

pub fn get_logger() -> &'static Mutex<Option<Logger>> {
    &LOGGER
}

pub fn init_logger() {
    let mut logger = LOGGER.lock().unwrap();
    if logger.is_none() {
        *logger = Some(Logger::new());
    }
}

pub fn log_info(message: &str) {
    init_logger();
    if let Ok(logger) = LOGGER.lock() {
        if let Some(l) = logger.as_ref() {
            l.info(message);
        }
    }
}

pub fn log_error(message: &str) {
    init_logger();
    if let Ok(logger) = LOGGER.lock() {
        if let Some(l) = logger.as_ref() {
            l.error(message);
        }
    }
}

pub fn log_warn(message: &str) {
    init_logger();
    if let Ok(logger) = LOGGER.lock() {
        if let Some(l) = logger.as_ref() {
            l.warn(message);
        }
    }
}

pub fn log_debug(message: &str) {
    init_logger();
    if let Ok(logger) = LOGGER.lock() {
        if let Some(l) = logger.as_ref() {
            l.debug(message);
        }
    }
}
