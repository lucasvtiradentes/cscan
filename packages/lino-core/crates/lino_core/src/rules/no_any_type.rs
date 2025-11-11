use crate::types::{Issue, Severity};
use crate::rules::{Rule, RuleRegistration};
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};
use std::path::Path;
use std::sync::Arc;

pub struct NoAnyTypeRule;

inventory::submit!(RuleRegistration {
    name: "no-any-type",
    factory: || Arc::new(NoAnyTypeRule),
});

impl Rule for NoAnyTypeRule {
    fn name(&self) -> &str {
        "no-any-type"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = AnyTypeVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct AnyTypeVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for AnyTypeVisitor<'a> {
    fn visit_ts_keyword_type(&mut self, n: &TsKeywordType) {
        if matches!(n.kind, TsKeywordTypeKind::TsAnyKeyword) {
            let span = n.span();
            let (line, column) = self.get_line_col(span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "no-any-type".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: "Found `: any` type annotation".to_string(),
                severity: Severity::Error,
            });
        }
        n.visit_children_with(self);
    }

    fn visit_ts_as_expr(&mut self, n: &TsAsExpr) {
        if let TsType::TsKeywordType(ref kw) = &*n.type_ann {
            if matches!(kw.kind, TsKeywordTypeKind::TsAnyKeyword) {
                let span = kw.span();
                let (line, column) = self.get_line_col(span.lo.0 as usize);

                self.issues.push(Issue {
                    rule: "no-any-type".to_string(),
                    file: self.path.clone(),
                    line,
                    column,
                    message: "Found `as any` type assertion".to_string(),
                    severity: Severity::Error,
                });
            }
        }
        n.visit_children_with(self);
    }
}

impl<'a> AnyTypeVisitor<'a> {
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
