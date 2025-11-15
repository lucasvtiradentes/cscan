use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoAbsoluteImportsRule;

inventory::submit!(RuleRegistration {
    name: "no-absolute-imports",
    factory: || Arc::new(NoAbsoluteImportsRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-absolute-imports",
        display_name: "No Absolute Imports",
        description:
            "Disallows absolute imports without alias. Prefer relative or aliased imports.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Warning,
        default_enabled: false,
        category: RuleCategory::Imports,
    }
});

impl Rule for NoAbsoluteImportsRule {
    fn name(&self) -> &str {
        "no-absolute-imports"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = AbsoluteImportVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct AbsoluteImportVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
}

impl<'a> Visit for AbsoluteImportVisitor<'a> {
    fn visit_import_decl(&mut self, n: &ImportDecl) {
        let span = n.src.span;
        let import_start = span.lo.0 as usize;
        let import_end = span.hi.0 as usize;

        if import_start < self.source.len() && import_end <= self.source.len() {
            let src_slice = &self.source[import_start..import_end];
            let import_path = src_slice.trim_matches('"').trim_matches('\'');

            if !import_path.starts_with('.')
                && !import_path.starts_with('@')
                && !import_path.starts_with("node:")
            {
                let is_builtin = matches!(
                    import_path,
                    "fs" | "path"
                        | "http"
                        | "https"
                        | "crypto"
                        | "os"
                        | "util"
                        | "events"
                        | "stream"
                        | "buffer"
                        | "child_process"
                        | "url"
                        | "querystring"
                        | "zlib"
                        | "net"
                        | "tls"
                        | "dns"
                        | "assert"
                        | "cluster"
                        | "dgram"
                        | "readline"
                        | "repl"
                        | "tty"
                        | "vm"
                        | "worker_threads"
                );

                if !is_builtin {
                    let (line, column) = get_line_col(self.source, import_start);

                    self.issues.push(Issue {
                        rule: "no-absolute-imports".to_string(),
                        file: self.path.clone(),
                        line,
                        column,
                        message: "Use relative or aliased imports instead of absolute imports"
                            .to_string(),
                        severity: Severity::Warning,
                        line_text: None,
                    });
                }
            }
        }
        n.visit_children_with(self);
    }
}

impl<'a> AbsoluteImportVisitor<'a> {}
