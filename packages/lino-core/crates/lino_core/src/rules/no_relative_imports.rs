use crate::types::{Issue, Severity};
use crate::rules::{Rule, RuleRegistration};
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};
use std::path::Path;
use std::sync::Arc;

pub struct NoRelativeImportsRule;

inventory::submit!(RuleRegistration {
    name: "no-relative-imports",
    factory: || Arc::new(NoRelativeImportsRule),
});

impl Rule for NoRelativeImportsRule {
    fn name(&self) -> &str {
        "no-relative-imports"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = RelativeImportVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct RelativeImportVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for RelativeImportVisitor<'a> {
    fn visit_import_decl(&mut self, n: &ImportDecl) {
        let span = n.src.span;
        let import_start = span.lo.0 as usize;
        let import_end = span.hi.0 as usize;

        if import_start < self.source.len() && import_end <= self.source.len() {
            let src_slice = &self.source[import_start..import_end];
            if src_slice.trim_matches('"').trim_matches('\'').starts_with('.') {
                let (line, column) = self.get_line_col(import_start);

                self.issues.push(Issue {
                    rule: "no-relative-imports".to_string(),
                    file: self.path.clone(),
                    line,
                    column,
                    message: format!("Use absolute imports with @ prefix instead of relative imports"),
                    severity: Severity::Warning,
                });
            }
        }
        n.visit_children_with(self);
    }
}

impl<'a> RelativeImportVisitor<'a> {
    fn get_line_col(&self, byte_pos: usize) -> (usize, usize) {
        let mut line = 1;
        let mut col = 1;

        for (i, ch) in self.source.char_indices() {
            if i >= byte_pos {
                break;
            }
            if ch == '\n' {
                line += 1;
                col = 1;
            } else {
                col += 1;
            }
        }

        (line, col)
    }
}
