use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct PreferConstRule;

inventory::submit!(RuleRegistration {
    name: "prefer-const",
    factory: || Arc::new(PreferConstRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "prefer-const",
        display_name: "Prefer Const",
        description: "Suggests using 'const' instead of 'let' when variables are never reassigned.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Variables,
    }
});

impl Rule for PreferConstRule {
    fn name(&self) -> &str {
        "prefer-const"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut collector = VariableCollector {
            let_declarations: HashMap::new(),
            source,
        };
        program.visit_with(&mut collector);

        let mut checker = ReassignmentChecker {
            reassigned: HashSet::new(),
        };
        program.visit_with(&mut checker);

        let mut issues = Vec::new();

        for (name, (line, column)) in collector.let_declarations {
            if !checker.reassigned.contains(&name) {
                issues.push(Issue {
                    rule: "prefer-const".to_string(),
                    file: path.to_path_buf(),
                    line,
                    column,
                    message: format!("'{}' is never reassigned, use 'const' instead", name),
                    severity: Severity::Warning,
                    line_text: None,
                });
            }
        }

        issues
    }
}

struct VariableCollector<'a> {
    let_declarations: HashMap<String, (usize, usize)>,
    source: &'a str,
}

impl<'a> VariableCollector<'a> {}

impl<'a> Visit for VariableCollector<'a> {
    fn visit_var_decl(&mut self, n: &VarDecl) {
        if matches!(n.kind, VarDeclKind::Let) {
            for decl in &n.decls {
                if let Pat::Ident(ident) = &decl.name {
                    let name = ident.id.sym.to_string();
                    let span = ident.span();
                    let (line, column) = get_line_col(self.source, span.lo.0 as usize);
                    self.let_declarations.insert(name, (line, column));
                }
            }
        }
        n.visit_children_with(self);
    }
}

struct ReassignmentChecker {
    reassigned: HashSet<String>,
}

impl Visit for ReassignmentChecker {
    fn visit_assign_expr(&mut self, n: &AssignExpr) {
        if let AssignTarget::Simple(SimpleAssignTarget::Ident(ident)) = &n.left {
            self.reassigned.insert(ident.id.sym.to_string());
        }
        n.visit_children_with(self);
    }

    fn visit_update_expr(&mut self, n: &UpdateExpr) {
        if let Expr::Ident(ident) = &*n.arg {
            self.reassigned.insert(ident.sym.to_string());
        }
        n.visit_children_with(self);
    }
}
