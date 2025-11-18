use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoEmptyFunctionRule;

inventory::submit!(RuleRegistration {
    name: "no-empty-function",
    factory: || Arc::new(NoEmptyFunctionRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-empty-function",
        display_name: "No Empty Function",
        description: "Disallows empty functions and methods. Empty functions are often leftovers from incomplete code.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::CodeQuality,
    }
});

impl Rule for NoEmptyFunctionRule {
    fn name(&self) -> &str {
        "no-empty-function"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = EmptyFunctionVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct EmptyFunctionVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> EmptyFunctionVisitor<'a> {
    fn is_empty_block(&self, block: &BlockStmt) -> bool {
        block.stmts.is_empty()
    }

    fn check_empty_function(&mut self, body: &BlockStmt, span: swc_common::Span, kind: &str) {
        if self.is_empty_block(body) {
            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "no-empty-function".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: format!("Empty {} body", kind),
                severity: Severity::Warning,
                line_text: None,
            });
        }
    }
}

impl<'a> Visit for EmptyFunctionVisitor<'a> {
    fn visit_function(&mut self, n: &Function) {
        if let Some(body) = &n.body {
            self.check_empty_function(body, n.span, "function");
        }
        n.visit_children_with(self);
    }

    fn visit_arrow_expr(&mut self, n: &ArrowExpr) {
        if let BlockStmtOrExpr::BlockStmt(body) = &*n.body {
            self.check_empty_function(body, n.span, "arrow function");
        }
        n.visit_children_with(self);
    }

    fn visit_class_method(&mut self, n: &ClassMethod) {
        if let Some(body) = &n.function.body {
            self.check_empty_function(body, n.span(), "method");
        }
        n.visit_children_with(self);
    }
}
