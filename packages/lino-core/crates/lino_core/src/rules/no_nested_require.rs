use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoNestedRequireRule;

inventory::submit!(RuleRegistration {
    name: "no-nested-require",
    factory: || Arc::new(NoNestedRequireRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-nested-require",
        display_name: "No Nested Require",
        description: "Disallows require() calls inside functions, blocks, or conditionals. Require statements should be at the top level for static analysis.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Imports,
    }
});

impl Rule for NoNestedRequireRule {
    fn name(&self) -> &str {
        "no-nested-require"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = NestedRequireVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
            depth: 0,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct NestedRequireVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
    depth: usize,
}

impl<'a> Visit for NestedRequireVisitor<'a> {
    fn visit_function(&mut self, n: &Function) {
        self.depth += 1;
        n.visit_children_with(self);
        self.depth -= 1;
    }

    fn visit_arrow_expr(&mut self, n: &ArrowExpr) {
        self.depth += 1;
        n.visit_children_with(self);
        self.depth -= 1;
    }

    fn visit_block_stmt(&mut self, n: &BlockStmt) {
        self.depth += 1;
        n.visit_children_with(self);
        self.depth -= 1;
    }

    fn visit_if_stmt(&mut self, n: &IfStmt) {
        self.depth += 1;
        n.visit_children_with(self);
        self.depth -= 1;
    }

    fn visit_call_expr(&mut self, n: &CallExpr) {
        if self.depth > 0 {
            if let Callee::Expr(box_expr) = &n.callee {
                if let Expr::Ident(ident) = &**box_expr {
                    if ident.sym.as_ref() == "require" {
                        let (line, column) = get_line_col(self.source, n.span.lo.0 as usize);

                        self.issues.push(Issue {
                            rule: "no-nested-require".to_string(),
                            file: self.path.clone(),
                            line,
                            column,
                            message: "require() calls should not be nested inside functions or blocks. Move to top level for static analysis.".to_string(),
                            severity: Severity::Warning,
                            line_text: None,
                        });
                    }
                }
            }
        }
        n.visit_children_with(self);
    }
}
