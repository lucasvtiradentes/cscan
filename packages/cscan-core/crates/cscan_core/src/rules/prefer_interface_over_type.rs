use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct PreferInterfaceOverTypeRule;

inventory::submit!(RuleRegistration {
    name: "prefer-interface-over-type",
    factory: || Arc::new(PreferInterfaceOverTypeRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "prefer-interface-over-type",
        display_name: "Prefer Interface Over Type",
        description: "Suggests using 'interface' keyword instead of 'type' for consistency.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Style,
    }
});

impl Rule for PreferInterfaceOverTypeRule {
    fn name(&self) -> &str {
        "prefer-interface-over-type"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = TypeAliasVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct TypeAliasVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for TypeAliasVisitor<'a> {
    fn visit_ts_type_alias_decl(&mut self, n: &TsTypeAliasDecl) {
        if let TsType::TsTypeLit(_) = n.type_ann.as_ref() {
            let span = n.span();
            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

            self.issues.push(Issue {
                rule: "prefer-interface-over-type".to_string(),
                file: self.path.clone(),
                line,
                column,
                message: "Use 'interface' instead of 'type' for object types".to_string(),
                severity: Severity::Warning,
                line_text: None,
            });
        }
        n.visit_children_with(self);
    }
}

impl<'a> TypeAliasVisitor<'a> {}
