use crate::rules::Rule;
use crate::types::{Issue, Severity};
use regex::Regex;
use std::path::Path;
use swc_ecma_ast::Program;

pub struct RegexRule {
    name: String,
    pattern: Regex,
    message: String,
    severity: Severity,
}

impl RegexRule {
    pub fn new(
        name: String,
        pattern: String,
        message: String,
        severity: Severity,
    ) -> Result<Self, regex::Error> {
        Ok(Self {
            name,
            pattern: Regex::new(&pattern)?,
            message,
            severity,
        })
    }
}

impl Rule for RegexRule {
    fn name(&self) -> &str {
        &self.name
    }

    fn check(&self, _program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut issues = Vec::new();

        for (line_num, line) in source.lines().enumerate() {
            if let Some(mat) = self.pattern.find(line) {
                issues.push(Issue {
                    rule: self.name.clone(),
                    file: path.to_path_buf(),
                    line: line_num + 1,
                    column: mat.start() + 1,
                    message: self.message.clone(),
                    severity: self.severity,
                    line_text: None,
                });
            }
        }

        issues
    }
}
