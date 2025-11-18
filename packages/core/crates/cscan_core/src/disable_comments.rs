use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

static DISABLE_FILE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"//\s*cscan-disable-file").unwrap());
static DISABLE_LINE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"//\s*cscan-disable(?:-line)?\s+(.+)").unwrap());
static DISABLE_NEXT_LINE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"//\s*cscan-disable-next-line\s+(.+)").unwrap());

#[derive(Debug, Clone)]
pub struct DisableDirectives {
    pub file_disabled: bool,
    pub line_disabled_rules: HashMap<usize, HashSet<String>>,
}

impl DisableDirectives {
    pub fn from_source(source: &str) -> Self {
        let mut file_disabled = false;
        let mut line_disabled_rules: HashMap<usize, HashSet<String>> = HashMap::new();

        for (line_num, line) in source.lines().enumerate() {
            let line_idx = line_num + 1;

            if DISABLE_FILE_RE.is_match(line) {
                file_disabled = true;
                continue;
            }

            if let Some(caps) = DISABLE_LINE_RE.captures(line) {
                if let Some(rules_str) = caps.get(1) {
                    let rules: HashSet<String> = rules_str
                        .as_str()
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    line_disabled_rules.insert(line_idx, rules);
                }
            }

            if let Some(caps) = DISABLE_NEXT_LINE_RE.captures(line) {
                if let Some(rules_str) = caps.get(1) {
                    let rules: HashSet<String> = rules_str
                        .as_str()
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    line_disabled_rules.insert(line_idx + 1, rules);
                }
            }
        }

        Self {
            file_disabled,
            line_disabled_rules,
        }
    }

    pub fn is_rule_disabled(&self, line: usize, rule_name: &str) -> bool {
        if self.file_disabled {
            return true;
        }

        if let Some(disabled_rules) = self.line_disabled_rules.get(&line) {
            return disabled_rules.contains(rule_name);
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disable_file() {
        let source = r#"
// cscan-disable-file
const x: any = 5;
"#;
        let directives = DisableDirectives::from_source(source);
        assert!(directives.file_disabled);
    }

    #[test]
    fn test_disable_line() {
        let source = r#"
const x: any = 5; // cscan-disable no-any-type
const y: any = 10;
"#;
        let directives = DisableDirectives::from_source(source);
        assert!(directives.is_rule_disabled(2, "no-any-type"));
        assert!(!directives.is_rule_disabled(3, "no-any-type"));
    }

    #[test]
    fn test_disable_next_line() {
        let source = r#"
// cscan-disable-next-line no-any-type
const x: any = 5;
const y: any = 10;
"#;
        let directives = DisableDirectives::from_source(source);
        assert!(directives.is_rule_disabled(3, "no-any-type"));
        assert!(!directives.is_rule_disabled(4, "no-any-type"));
    }

    #[test]
    fn test_disable_multiple_rules() {
        let source = r#"
// cscan-disable-next-line no-any-type, no-console-log
const x: any = 5;
console.log(x);
"#;
        let directives = DisableDirectives::from_source(source);
        assert!(directives.is_rule_disabled(3, "no-any-type"));
        assert!(directives.is_rule_disabled(3, "no-console-log"));
        assert!(!directives.is_rule_disabled(4, "no-any-type"));
    }
}
