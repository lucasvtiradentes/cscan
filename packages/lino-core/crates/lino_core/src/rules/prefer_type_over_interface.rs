use crate::types::{Issue, Severity};
use crate::rules::{Rule, RuleRegistration};
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};
use std::path::Path;
use std::sync::Arc;

pub struct PreferTypeOverInterfaceRule;

inventory::submit!(RuleRegistration {
    name: "prefer-type-over-interface",
    factory: || Arc::new(PreferTypeOverInterfaceRule),
});

impl Rule for PreferTypeOverInterfaceRule {
    fn name(&self) -> &str {
        "prefer-type-over-interface"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = InterfaceVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct InterfaceVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for InterfaceVisitor<'a> {
    fn visit_ts_interface_decl(&mut self, n: &TsInterfaceDecl) {
        let span = n.span();
        let (line, column) = self.get_line_col(span.lo.0 as usize);

        self.issues.push(Issue {
            rule: "prefer-type-over-interface".to_string(),
            file: self.path.clone(),
            line,
            column,
            message: format!("Prefer 'type' over 'interface' for '{}'", n.id.sym),
            severity: Severity::Warning,
        });

        n.visit_children_with(self);
    }
}

impl<'a> InterfaceVisitor<'a> {
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
