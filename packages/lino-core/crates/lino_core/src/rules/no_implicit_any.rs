use crate::config::RuleType;
use crate::rules::{Rule, RuleCategory, RuleMetadata, RuleMetadataRegistration, RuleRegistration};
use crate::types::{Issue, Severity};
use crate::utils::get_line_col;
use std::path::Path;
use std::sync::Arc;
use swc_common::Spanned;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

pub struct NoImplicitAnyRule;

inventory::submit!(RuleRegistration {
    name: "no-implicit-any",
    factory: || Arc::new(NoImplicitAnyRule),
});

inventory::submit!(RuleMetadataRegistration {
    metadata: RuleMetadata {
        name: "no-implicit-any",
        display_name: "No Implicit Any",
        description:
            "Detects function parameters without type annotations that implicitly have 'any' type.",
        rule_type: RuleType::Ast,
        default_severity: Severity::Error,
        default_enabled: false,
        category: RuleCategory::TypeSafety,
    }
});

impl Rule for NoImplicitAnyRule {
    fn name(&self) -> &str {
        "no-implicit-any"
    }

    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue> {
        let mut visitor = ImplicitAnyVisitor {
            issues: Vec::new(),
            path: path.to_path_buf(),
            source,
            in_inferred_context: false,
        };
        program.visit_with(&mut visitor);
        visitor.issues
    }
}

struct ImplicitAnyVisitor<'a> {
    issues: Vec<Issue>,
    path: std::path::PathBuf,
    source: &'a str,
    in_inferred_context: bool,
}

fn is_array_method(method_name: &str) -> bool {
    const ARRAY_METHODS: &[&str] = &[
        "map",
        "filter",
        "forEach",
        "reduce",
        "reduceRight",
        "find",
        "findIndex",
        "some",
        "every",
        "flatMap",
        "sort",
        "findLast",
        "findLastIndex",
    ];
    ARRAY_METHODS.contains(&method_name)
}

fn is_promise_method(method_name: &str) -> bool {
    const PROMISE_METHODS: &[&str] = &["then", "catch", "finally"];
    PROMISE_METHODS.contains(&method_name)
}

fn is_inferred_callback_context(method_name: &str) -> bool {
    is_array_method(method_name) || is_promise_method(method_name)
}

impl<'a> ImplicitAnyVisitor<'a> {
    fn check_param(&mut self, param: &Param) {
        if self.in_inferred_context {
            return;
        }

        match &param.pat {
            Pat::Ident(ident) => {
                if ident.type_ann.is_none() {
                    let span = ident.span();
                    let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                    self.issues.push(Issue {
                        rule: "no-implicit-any".to_string(),
                        file: self.path.clone(),
                        line,
                        column,
                        message: format!(
                            "Parameter '{}' implicitly has 'any' type. Add type annotation.",
                            ident.id.sym
                        ),
                        severity: Severity::Error,
                        line_text: None,
                    });
                }
            }
            Pat::Array(arr) => {
                if arr.type_ann.is_none() {
                    let span = arr.span();
                    let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                    self.issues.push(Issue {
                        rule: "no-implicit-any".to_string(),
                        file: self.path.clone(),
                        line,
                        column,
                        message:
                            "Destructured parameter implicitly has 'any' type. Add type annotation."
                                .to_string(),
                        severity: Severity::Error,
                        line_text: None,
                    });
                }
            }
            Pat::Object(obj) => {
                if obj.type_ann.is_none() {
                    let span = obj.span();
                    let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                    self.issues.push(Issue {
                        rule: "no-implicit-any".to_string(),
                        file: self.path.clone(),
                        line,
                        column,
                        message:
                            "Destructured parameter implicitly has 'any' type. Add type annotation."
                                .to_string(),
                        severity: Severity::Error,
                        line_text: None,
                    });
                }
            }
            Pat::Rest(rest) => {
                if rest.type_ann.is_none() {
                    let span = rest.span();
                    let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                    self.issues.push(Issue {
                        rule: "no-implicit-any".to_string(),
                        file: self.path.clone(),
                        line,
                        column,
                        message: "Rest parameter implicitly has 'any' type. Add type annotation."
                            .to_string(),
                        severity: Severity::Error,
                        line_text: None,
                    });
                }
            }
            _ => {}
        }
    }
}

impl<'a> Visit for ImplicitAnyVisitor<'a> {
    fn visit_function(&mut self, n: &Function) {
        for param in &n.params {
            self.check_param(param);
        }
        n.visit_children_with(self);
    }

    fn visit_arrow_expr(&mut self, n: &ArrowExpr) {
        if !self.in_inferred_context {
            for pat in &n.params {
                match pat {
                    Pat::Ident(ident) => {
                        if ident.type_ann.is_none() {
                            let span = ident.span();
                            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                            self.issues.push(Issue {
                                rule: "no-implicit-any".to_string(),
                                file: self.path.clone(),
                                line,
                                column,
                                message: format!(
                                    "Parameter '{}' implicitly has 'any' type. Add type annotation.",
                                    ident.id.sym
                                ),
                                severity: Severity::Error,
                                line_text: None,
                            });
                        }
                    }
                    Pat::Array(arr) => {
                        if arr.type_ann.is_none() {
                            let span = arr.span();
                            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                            self.issues.push(Issue {
                                rule: "no-implicit-any".to_string(),
                                file: self.path.clone(),
                                line,
                                column,
                                message: "Destructured parameter implicitly has 'any' type. Add type annotation.".to_string(),
                                severity: Severity::Error,
                                line_text: None,
                            });
                        }
                    }
                    Pat::Object(obj) => {
                        if obj.type_ann.is_none() {
                            let span = obj.span();
                            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                            self.issues.push(Issue {
                                rule: "no-implicit-any".to_string(),
                                file: self.path.clone(),
                                line,
                                column,
                                message: "Destructured parameter implicitly has 'any' type. Add type annotation.".to_string(),
                                severity: Severity::Error,
                                line_text: None,
                            });
                        }
                    }
                    Pat::Rest(rest) => {
                        if rest.type_ann.is_none() {
                            let span = rest.span();
                            let (line, column) = get_line_col(self.source, span.lo.0 as usize);

                            self.issues.push(Issue {
                                rule: "no-implicit-any".to_string(),
                                file: self.path.clone(),
                                line,
                                column,
                                message:
                                    "Rest parameter implicitly has 'any' type. Add type annotation."
                                        .to_string(),
                                severity: Severity::Error,
                                line_text: None,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
        n.visit_children_with(self);
    }

    fn visit_call_expr(&mut self, n: &CallExpr) {
        let has_arrow_callback = n
            .args
            .iter()
            .any(|arg| matches!(arg.expr.as_ref(), Expr::Arrow(_)));

        if has_arrow_callback {
            let prev_context = self.in_inferred_context;
            self.in_inferred_context = true;
            n.visit_children_with(self);
            self.in_inferred_context = prev_context;
            return;
        }

        if let Callee::Expr(callee_expr) = &n.callee {
            if let Expr::Member(member_expr) = callee_expr.as_ref() {
                if let MemberProp::Ident(ident) = &member_expr.prop {
                    let method_name = ident.sym.as_ref();
                    if is_inferred_callback_context(method_name) {
                        let prev_context = self.in_inferred_context;
                        self.in_inferred_context = true;
                        n.visit_children_with(self);
                        self.in_inferred_context = prev_context;
                        return;
                    }
                }
            }
        }
        n.visit_children_with(self);
    }
}
