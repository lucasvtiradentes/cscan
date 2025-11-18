use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct ConsistentReturnRule;

inventory::submit!(RuleRegistration {
    name: "consistent-return",
    factory: || Arc::new(ConsistentReturnRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "consistent-return",
        display_name: "Consistent Return",
        description: "Requires consistent return behavior in functions. Either all code paths return a value or none do.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::BugPrevention,
    }
});

impl Rule for ConsistentReturnRule {
    fn name(&self) -> &str {
        "consistent-return"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = ConsistentReturnVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct ConsistentReturnVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> ConsistentReturnVisitor<'a> {
    fn check_function_body(&mut self, body: &BlockStmt, func_span: swc_common::Span) {
        let mut return_collector = ReturnCollector {
            returns: Vec::new(),
        };
        body.visit_with(&mut return_collector);

        if return_collector.returns.is_empty() {
            return;
        }

        let has_value = return_collector.returns.iter().any(|r| r.has_value);
        let has_no_value = return_collector.returns.iter().any(|r| !r.has_value);

        if has_value && has_no_value {
            let (line, column) = get_line_col(self.source, func_span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "consistent-return".to_string(),
                file: self.path.clone(),
                line,
                column,
                message:
                    "Function has inconsistent return statements. Some return values, others don't."
                        .to_string(),
                severity: Severity::Warning,
                line_text: None,
            });
        }
    }
}

impl<'a> Visit for ConsistentReturnVisitor<'a> {
    fn visit_function(&mut self, n: &Function) {
        if let Some(body) = &n.body {
            self.check_function_body(body, n.span);
        }
        n.visit_children_with(self);
    }

    fn visit_arrow_expr(&mut self, n: &ArrowExpr) {
        if let BlockStmtOrExpr::BlockStmt(body) = &*n.body {
            self.check_function_body(body, n.span);
        }
        n.visit_children_with(self);
    }
}

struct ReturnInfo {
    has_value: bool,
}

struct ReturnCollector {
    returns: Vec<ReturnInfo>,
}

impl Visit for ReturnCollector {
    fn visit_return_stmt(&mut self, n: &ReturnStmt) {
        self.returns.push(ReturnInfo {
            has_value: n.arg.is_some(),
        });
        n.visit_children_with(self);
    }

    fn visit_function(&mut self, n: &Function) {
        n.visit_children_with(self);
    }

    fn visit_arrow_expr(&mut self, n: &ArrowExpr) {
        n.visit_children_with(self);
    }
}
