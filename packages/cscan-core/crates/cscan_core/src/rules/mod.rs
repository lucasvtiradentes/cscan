use crate::types::Issue;
use std::path::Path;
use std::sync::Arc;
use swc_ecma_ast::Program;

pub trait Rule: Send + Sync {
    fn name(&self) -> &str;
    fn check(&self, program: &Program, path: &Path, source: &str) -> Vec<Issue>;
}

pub struct RuleRegistration {
    pub name: &'static str,
    pub factory: fn() -> Arc<dyn Rule>,
}

inventory::collect!(RuleRegistration);

mod consistent_return;
mod max_function_length;
mod metadata;
mod no_absolute_imports;
mod no_alias_imports;
mod no_any_type;
mod no_console_log;
mod no_constant_condition;
mod no_duplicate_imports;
mod no_dynamic_import;
mod no_empty_class;
mod no_empty_function;
mod no_implicit_any;
mod no_magic_numbers;
mod no_nested_require;
mod no_nested_ternary;
mod no_relative_imports;
mod no_todo_comments;
mod no_unreachable_code;
mod no_unused_vars;
mod no_var;
mod prefer_const;
mod prefer_interface_over_type;
mod prefer_type_over_interface;
mod regex_rule;

pub use metadata::{get_all_rule_metadata, RuleCategory, RuleMetadata, RuleMetadataRegistration};
pub use regex_rule::RegexRule;
