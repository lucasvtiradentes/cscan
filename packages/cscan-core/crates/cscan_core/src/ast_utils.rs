use swc_ecma_ast::*;

pub fn is_identifier(expr: &Expr) -> bool {
    matches!(expr, Expr::Ident(_))
}

pub fn get_function_params(func: &Function) -> Vec<String> {
    func.params
        .iter()
        .filter_map(|param| {
            if let Pat::Ident(ident) = &param.pat {
                Some(ident.id.sym.to_string())
            } else {
                None
            }
        })
        .collect()
}

pub fn is_arrow_function(expr: &Expr) -> bool {
    matches!(expr, Expr::Arrow(_))
}

pub fn is_function_expression(expr: &Expr) -> bool {
    matches!(expr, Expr::Fn(_))
}

pub fn is_call_expression(expr: &Expr) -> bool {
    matches!(expr, Expr::Call(_))
}

pub fn get_callee_name(expr: &Expr) -> Option<String> {
    if let Expr::Call(call) = expr {
        match &call.callee {
            Callee::Expr(box_expr) => match &**box_expr {
                Expr::Ident(ident) => Some(ident.sym.to_string()),
                Expr::Member(member) => {
                    if let MemberProp::Ident(ident_name) = &member.prop {
                        Some(ident_name.sym.to_string())
                    } else {
                        None
                    }
                }
                _ => None,
            },
            _ => None,
        }
    } else {
        None
    }
}

pub fn count_statements(stmts: &[Stmt]) -> usize {
    stmts.len()
}

pub fn is_ternary_expr(expr: &Expr) -> bool {
    matches!(expr, Expr::Cond(_))
}

pub fn has_nested_ternary(expr: &Expr) -> bool {
    if let Expr::Cond(cond) = expr {
        is_ternary_expr(&cond.cons) || is_ternary_expr(&cond.alt)
    } else {
        false
    }
}
