use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoAliasImportsRule;

inventory::submit!(RuleRegistration {
    name: "no-alias-imports",
    factory: || Arc::new(NoAliasImportsRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-alias-imports",
        display_name: "No Alias Imports",
        description: "Disallows aliased imports (starting with @). Prefer relative imports.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Imports,
    }
});

impl Rule for NoAliasImportsRule {
    fn name(&self) -> &str {
        "no-alias-imports"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = AliasImportVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct AliasImportVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for AliasImportVisitor<'a> {
    fn visit_import_decl(&mut self, n: &ImportDecl) {
        let span = n.src.span;
        let import_start = span.lo.0 as usize;
        let import_end = span.hi.0 as usize;

        if import_start < self.source.len() && import_end <= self.source.len() {
            let src_slice = &self.source[import_start..import_end];
            if src_slice
                .trim_matches('"')
                .trim_matches('\'')
                .starts_with('@')
            {
                let (line, column) = get_line_col(self.source, import_start);

                self.issues.push(Issue {
                    rule: "no-alias-imports".to_string(),
                    file: self.path.clone(),
                    line,
                    column,
                    message: "Use relative imports instead of aliased imports".to_string(),
                    severity: Severity::Warning,
                    line_text: None,
                });
            }
        }
        n.visit_children_with(self);
    }
}

impl<'a> AliasImportVisitor<'a> {}
