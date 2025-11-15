use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoDynamicImportRule;

inventory::submit!(RuleRegistration {
    name: "no-dynamic-import",
    factory: || Arc::new(NoDynamicImportRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-dynamic-import",
        display_name: "No Dynamic Import",
        description: "Disallows dynamic import() expressions. Dynamic imports make static analysis harder and can impact bundle optimization.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Imports,
    }
});

impl Rule for NoDynamicImportRule {
    fn name(&self) -> &str {
        "no-dynamic-import"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = DynamicImportVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct DynamicImportVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for DynamicImportVisitor<'a> {
    fn visit_call_expr(&mut self, n: &CallExpr) {
        if let Callee::Import(_) = &n.callee {
            let (line, column) = get_line_col(self.source, n.span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "no-dynamic-import".to_string(),
                file: self.path.clone(),
                line,
                column,
                message:
                    "Dynamic import() is not allowed. Use static imports at the top of the file."
                        .to_string(),
                severity: Severity::Warning,
                line_text: None,
            });
        }
        n.visit_children_with(self);
    }
}
