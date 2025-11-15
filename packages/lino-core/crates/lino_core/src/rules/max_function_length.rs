use crate::ast_utils::count_statements;
use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct MaxFunctionLengthRule;

inventory::submit!(RuleRegistration {
    name: "max-function-length",
    factory: || Arc::new(MaxFunctionLengthRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "max-function-length",
        display_name: "Max Function Length",
        description:
            "Enforces a maximum number of statements in functions (default: 50). Long functions are harder to understand and maintain.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::CodeQuality,
    }
});

impl Rule for MaxFunctionLengthRule {
    fn name(&self) -> &str {
        "max-function-length"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = MaxFunctionLengthVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
            max_length: 50,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct MaxFunctionLengthVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
    max_length: usize,
}

impl<'a> MaxFunctionLengthVisitor<'a> {
    fn check_function_length(&mut self, body: &BlockStmt, span: swc_common::Span, name: &str) {
        let stmt_count = count_statements(&body.stmts);

        if stmt_count > self.max_length {
            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "max-function-length".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: format!(
                    "Function '{}' has {} statements (max: {}). Consider breaking it into smaller functions.",
                    name, stmt_count, self.max_length
                ),
                severity: Severity::Warning,
                line_text: None,
            });
        }
    }
}

impl<'a> Visit for MaxFunctionLengthVisitor<'a> {
    fn visit_function(&mut self, n: &Function) {
        if let Some(body) = &n.body {
            self.check_function_length(body, n.span, "anonymous");
        }
        n.visit_children_with(self);
    }

    fn visit_fn_decl(&mut self, n: &FnDecl) {
        if let Some(body) = &n.function.body {
            self.check_function_length(body, n.function.span, n.ident.sym.as_ref());
        }
        n.visit_children_with(self);
    }

    fn visit_arrow_expr(&mut self, n: &ArrowExpr) {
        if let BlockStmtOrExpr::BlockStmt(body) = &*n.body {
            self.check_function_length(body, n.span, "arrow");
        }
        n.visit_children_with(self);
    }
}
