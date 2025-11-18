use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use regex::Regex;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::Program;

pub struct NoTodoCommentsRule;

inventory::submit!(RuleRegistration {
    name: "no-todo-comments",
    factory: || Arc::new(NoTodoCommentsRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-todo-comments",
        display_name: "No TODO Comments",
        description: "Detects TODO, FIXME, and similar comment markers.",
        rule_type: RuleType::Regex,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::CodeQuality,
    }
});

impl Rule for NoTodoCommentsRule {
    fn name(&self) -> &str {
        "no-todo-comments"
    }

    fn check(&self, _program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let regex = Regex::new(r"//\s*(TODO|FIXME|HACK|XXX|NOTE|BUG)").unwrap();
        let mut issues = Vec::new();

        for (line_num, line) in source.lines().enumerate() {
            if let Some(mat) = regex.find(line) {
                issues.push(Issue {
                    rule: self.name().to_string(),
                    file: path.to_path_buf(),
                    line: line_num + 1,
                    column: mat.start() + 1,
                    message: "Comment marker found. Consider creating an issue instead".to_string(),
                    severity: Severity::Warning,
                    line_text: None,
                });
            }
        }

        issues
    }
}
