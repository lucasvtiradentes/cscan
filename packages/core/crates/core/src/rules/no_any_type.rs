use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoAnyTypeRule;

inventory::submit!(RuleRegistration {
    name: "no-any-type",
    factory: || Arc::new(NoAnyTypeRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-any-type",
        display_name: "No Any Type",
        description: "Detects usage of TypeScript 'any' type (`: any` and `as any`). Using 'any' defeats the purpose of TypeScript's type system.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Error,
        default_enabled: false,
        category: RuleCategory::TypeSafety,
    }
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
            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "no-any-type".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: "Found `: any` type annotation".to_string(),
                severity: Severity::Error,
                line_text: None,
            });
        }
        n.visit_children_with(self);
    }

    fn visit_ts_as_expr(&mut self, n: &TsAsExpr) {
        if let TsType::TsKeywordType(ref kw) = &*n.type_ann {
            if matches!(kw.kind, TsKeywordTypeKind::TsAnyKeyword) {
                let span = kw.span();
                let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                self.issues.push(Issue {
                    rule: "no-any-type".to_string(),
                    file: self.path.clone(),
                    line,
                    column,
                    message: "Found `as any` type assertion".to_string(),
                    severity: Severity::Error,
                    line_text: None,
                });
            }
        }
        n.visit_children_with(self);
    }
}
