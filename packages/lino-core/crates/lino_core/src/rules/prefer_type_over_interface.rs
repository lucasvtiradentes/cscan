use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct PreferTypeOverInterfaceRule;

inventory::submit!(RuleRegistration {
    name: "prefer-type-over-interface",
    factory: || Arc::new(PreferTypeOverInterfaceRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "prefer-type-over-interface",
        display_name: "Prefer Type Over Interface",
        description: "Suggests using 'type' keyword instead of 'interface' for consistency. Type aliases are more flexible and composable.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Style,
    }
});

impl Rule for PreferTypeOverInterfaceRule {
    fn name(&self) -> &str {
        "prefer-type-over-interface"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = InterfaceVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct InterfaceVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for InterfaceVisitor<'a> {
    fn visit_ts_interface_decl(&mut self, n: &TsInterfaceDecl) {
        let span = n.span();
        let (line, column) = get_line_col(self.source, span.lo.0 as usize);

        self.issues.push(Issue {
            rule: "prefer-type-over-interface".to_string(),
            file: self.path.clone(),
            line,
            column,
            message: format!("Prefer 'type' over 'interface' for '{}'", n.id.sym),
            severity: Severity::Warning,
            line_text: None,
        });

        n.visit_children_with(self);
    }
}

impl<'a> InterfaceVisitor<'a> {}
