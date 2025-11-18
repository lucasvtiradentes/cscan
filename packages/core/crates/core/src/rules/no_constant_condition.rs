use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoConstantConditionRule;

inventory::submit!(RuleRegistration {
    name: "no-constant-condition",
    factory: || Arc::new(NoConstantConditionRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-constant-condition",
        display_name: "No Constant Condition",
        description: "Disallows constant expressions in conditions (if/while/for/ternary). Likely a programming error.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Error,
        default_enabled: false,
        category: RuleCategory::BugPrevention,
    }
});

impl Rule for NoConstantConditionRule {
    fn name(&self) -> &str {
        "no-constant-condition"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = ConstantConditionVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct ConstantConditionVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> ConstantConditionVisitor<'a> {
    fn is_constant(expr: &Expr) -> bool {
        match expr {
            Expr::Lit(Lit::Bool(_)) => true,
            Expr::Lit(Lit::Num(_)) => true,
            Expr::Lit(Lit::Str(_)) => true,
            Expr::Lit(Lit::Null(_)) => true,
            Expr::Unary(unary)
                if matches!(unary.op, UnaryOp::Bang | UnaryOp::Minus | UnaryOp::Plus) =>
            {
                Self::is_constant(&unary.arg)
            }
            _ => false,
        }
    }

    fn check_condition(&mut self, test: &Expr, context: &str) {
        if Self::is_constant(test) {
            let span = test.span();
            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "no-constant-condition".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: format!("Constant condition in {}", context),
                severity: Severity::Error,
                line_text: None,
            });
        }
    }
}

impl<'a> Visit for ConstantConditionVisitor<'a> {
    fn visit_if_stmt(&mut self, n: &IfStmt) {
        self.check_condition(&n.test, "if statement");
        n.visit_children_with(self);
    }

    fn visit_while_stmt(&mut self, n: &WhileStmt) {
        self.check_condition(&n.test, "while loop");
        n.visit_children_with(self);
    }

    fn visit_do_while_stmt(&mut self, n: &DoWhileStmt) {
        self.check_condition(&n.test, "do-while loop");
        n.visit_children_with(self);
    }

    fn visit_for_stmt(&mut self, n: &ForStmt) {
        if let Some(test) = &n.test {
            self.check_condition(test, "for loop");
        }
        n.visit_children_with(self);
    }

    fn visit_cond_expr(&mut self, n: &CondExpr) {
        self.check_condition(&n.test, "ternary expression");
        n.visit_children_with(self);
    }
}
