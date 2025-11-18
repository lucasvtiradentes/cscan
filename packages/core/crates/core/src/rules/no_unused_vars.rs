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

pub struct NoUnusedVarsRule;

inventory::submit!(RuleRegistration {
    name: "no-unused-vars",
    factory: || Arc::new(NoUnusedVarsRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-unused-vars",
        display_name: "No Unused Variables",
        description: "Detects variables that are declared but never used in the code.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::CodeQuality,
    }
});

impl Rule for NoUnusedVarsRule {
    fn name(&self) -> &str {
        "no-unused-vars"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = UnusedVarsVisitor {
            issues: Vec::new(),
            _path: path.to_path_buf(),
            _source: source,
            declared_vars: HashMap::new(),
            used_vars: HashSet::new(),
        };
        program.visit_with(&mut visitor);

        for (name, span) in &visitor.declared_vars {
            if !visitor.used_vars.contains(name) && !name.starts_with('_') {
                let (line, column) = get_line_col(source, span.lo.0 as usize);

                visitor.issues.push(Issue {
                    rule: "no-unused-vars".to_string(),
                    file: path.to_path_buf(),
                    line,
                    column,
                    message: format!("Variable '{}' is declared but never used.", name),
                    severity: Severity::Warning,
                    line_text: None,
                });
            }
        }

        visitor.issues
    }
}

struct UnusedVarsVisitor<'a> {
    issues: Vec<Issue>,
    _path: std::path::PathBuf,
    _source: &'a str,
    declared_vars: HashMap<String, swc_common::Span>,
    used_vars: HashSet<String>,
}

impl<'a> Visit for UnusedVarsVisitor<'a> {
    fn visit_var_decl(&mut self, n: &VarDecl) {
        for decl in &n.decls {
            if let Pat::Ident(ident) = &decl.name {
                self.declared_vars
                    .insert(ident.id.sym.to_string(), ident.span());
            }
        }
        n.visit_children_with(self);
    }

    fn visit_ident(&mut self, n: &Ident) {
        self.used_vars.insert(n.sym.to_string());
        n.visit_children_with(self);
    }

    fn visit_fn_decl(&mut self, n: &FnDecl) {
        self.declared_vars
            .insert(n.ident.sym.to_string(), n.ident.span());
        n.visit_children_with(self);
    }
}
