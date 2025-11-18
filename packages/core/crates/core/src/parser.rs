use anyhow::Result;
use std::path::Path;
use swc_common::{sync::Lrc, FileName, SourceMap};
use swc_ecma_ast::Program;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};

pub fn parse_file(path: &Path, source: &str) -> Result<Program> {
    let cm: Lrc<SourceMap> = Default::default();

    let fm = cm.new_source_file(
        FileName::Real(path.to_path_buf()).into(),
        source.to_string(),
    );

    let lexer = Lexer::new(
        Syntax::Typescript(TsSyntax {
            tsx: path.extension().and_then(|e| e.to_str()) == Some("tsx"),
            decorators: true,
            dts: false,
            no_early_errors: true,
            disallow_ambiguous_jsx_like: false,
        }),
        Default::default(),
        StringInput::from(&*fm),
        None,
    );

    let mut parser = Parser::new_from(lexer);

    parser
        .parse_program()
        .map_err(|e| anyhow::anyhow!("Parse error: {:?}", e))
}
