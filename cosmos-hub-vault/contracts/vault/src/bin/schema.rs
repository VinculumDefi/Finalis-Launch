use cosmwasm_schema::export_schema;
// RED-TEAM / NON-PRODUCTION schema generator.

fn main() {
    let mut out = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    out.push("schema");
    std::fs::create_dir_all(&out).unwrap();
    export_schema(&mut out);
}