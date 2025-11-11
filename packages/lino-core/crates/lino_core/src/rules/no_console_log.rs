use crate::types::{Issue, Severity};
use crate::rules::{Rule, RuleRegistration};
use swc_ecma_ast::Program;
use std::path::Path;
use std::sync::Arc;
use regex::Regex;

pub struct NoConsoleLogRule;

inventory::submit!(RuleRegistration {
    name: "no-console-log",
    factory: || Arc::new(NoConsoleLogRule),
});

impl Rule for NoConsoleLogRule {
    fn name(&self) -> &str {
        "no-console-log"
    }

    fn check(&self, _program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let regex = Regex::new(r"console\.log\(").unwrap();
        let mut issues = Vec::new();

        for (line_num, line) in source.lines().enumerate() {
            if let Some(mat) = regex.find(line) {
                issues.push(Issue {
                    rule: self.name().to_string(),
                    file: path.to_path_buf(),
                    line: line_num + 1,
                    column: mat.start() + 1,
                    message: "Avoid using console.log in production code".to_string(),
                    severity: Severity::Warning,
                });
            }
        }

        issues
    }
}
