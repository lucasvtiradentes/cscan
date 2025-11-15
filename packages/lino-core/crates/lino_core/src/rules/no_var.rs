use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoVarRule;

inventory::submit!(RuleRegistration {
    name: "no-var",
    factory: || Arc::new(NoVarRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-var",
        display_name: "No Var",
        description: "Disallows the use of 'var' keyword. Use 'let' or 'const' instead for block-scoped variables.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Variables,
    }
});

impl Rule for NoVarRule {
    fn name(&self) -> &str {
        "no-var"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = NoVarVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct NoVarVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for NoVarVisitor<'a> {
    fn visit_var_decl(&mut self, n: &VarDecl) {
        if matches!(n.kind, VarDeclKind::Var) {
            let span = n.span();
            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "no-var".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: "Use 'let' or 'const' instead of 'var'".to_string(),
                severity: Severity::Warning,
                line_text: None,
            });
        }
        n.visit_children_with(self);
    }
}

impl<'a> NoVarVisitor<'a> {}
